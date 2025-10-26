#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
test_vintern.py
Quick tester for Vintern-1B vision-language model.

Usage:
  python test_vintern.py --image path/to/your_image.jpg
  python test_vintern.py --image sample.jpg --prompt "<image>\nMô tả chi tiết bằng markdown."
  python test_vintern.py --model 5CD-AI/Vintern-1B-v3_5 --image sample.jpg --loop 3

Dependencies:
  pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision
  pip install pillow transformers==4.37.2
"""

import os
import time
import argparse
from typing import List, Tuple

import torch
import torchvision.transforms as T
from PIL import Image
from torchvision.transforms.functional import InterpolationMode
from transformers import AutoModel, AutoTokenizer

# --- Try to reuse functions if your existing script is importable (optional) ---
# Rename 'vintern_infer' to the filename of your existing script (without .py) if needed.
_HAVE_EXTERNAL_FUNCS = False
try:
    from vintern_infer import build_transform, dynamic_preprocess, load_image  # noqa: F401
    _HAVE_EXTERNAL_FUNCS = True
except Exception:
    _HAVE_EXTERNAL_FUNCS = False


IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


# --- Local fallback versions (used if external ones are not importable) ---
def _build_transform(input_size: int):
    return T.Compose([
        T.Lambda(lambda img: img.convert('RGB') if img.mode != 'RGB' else img),
        T.Resize((input_size, input_size), interpolation=InterpolationMode.BICUBIC),
        T.ToTensor(),
        T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def _find_closest_aspect_ratio(aspect_ratio: float,
                               target_ratios: List[Tuple[int, int]],
                               width: int, height: int, image_size: int) -> Tuple[int, int]:
    best_ratio_diff = float('inf')
    best_ratio = (1, 1)
    area = width * height
    for ratio in target_ratios:
        target_aspect_ratio = ratio[0] / ratio[1]
        ratio_diff = abs(aspect_ratio - target_aspect_ratio)
        if ratio_diff < best_ratio_diff:
            best_ratio_diff = ratio_diff
            best_ratio = ratio
        elif ratio_diff == best_ratio_diff:
            if area > 0.5 * image_size * image_size * ratio[0] * ratio[1]:
                best_ratio = ratio
    return best_ratio


def _dynamic_preprocess(image: Image.Image, min_num=1, max_num=12, image_size=448, use_thumbnail=False):
    orig_width, orig_height = image.size
    aspect_ratio = orig_width / orig_height
    target_ratios = sorted(
        {(i, j)
         for n in range(min_num, max_num + 1)
         for i in range(1, n + 1)
         for j in range(1, n + 1)
         if i * j <= max_num and i * j >= min_num},
        key=lambda x: x[0] * x[1]
    )
    target_aspect_ratio = _find_closest_aspect_ratio(
        aspect_ratio, target_ratios, orig_width, orig_height, image_size
    )
    target_w = image_size * target_aspect_ratio[0]
    target_h = image_size * target_aspect_ratio[1]
    blocks = target_aspect_ratio[0] * target_aspect_ratio[1]

    resized_img = image.resize((target_w, target_h))
    processed_images = []
    tiles_per_row = target_w // image_size

    for i in range(blocks):
        box = (
            (i % tiles_per_row) * image_size,
            (i // tiles_per_row) * image_size,
            ((i % tiles_per_row) + 1) * image_size,
            ((i // tiles_per_row) + 1) * image_size,
        )
        processed_images.append(resized_img.crop(box))

    if use_thumbnail and len(processed_images) != 1:
        processed_images.append(image.resize((image_size, image_size)))

    return processed_images


def _load_image(image_file: str, input_size=448, max_num=6, use_thumbnail=True):
    image = Image.open(image_file).convert('RGB')
    transform = _build_transform(input_size)
    imgs = _dynamic_preprocess(
        image, image_size=input_size, use_thumbnail=use_thumbnail, max_num=max_num
    )
    pixel_values = [transform(img) for img in imgs]
    return torch.stack(pixel_values)


# --- Model utilities ---
def get_device_and_dtype():
    if torch.cuda.is_available():
        return torch.device("cuda"), torch.bfloat16
    # bfloat16 trên CPU có thể hoạt động nhưng chậm; dùng float32 an toàn hơn
    return torch.device("cpu"), torch.float32


def load_model_and_tokenizer(model_name: str, device: torch.device, dtype: torch.dtype, use_flash_attn: bool):
    # Một số bản remote code hỗ trợ use_flash_attn, một số không – thử/catch cho chắc
    try:
        model = AutoModel.from_pretrained(
            model_name,
            torch_dtype=dtype,
            low_cpu_mem_usage=True,
            trust_remote_code=True,
            use_flash_attn=use_flash_attn,
        ).eval().to(device)
    except Exception:
        model = AutoModel.from_pretrained(
            model_name,
            torch_dtype=dtype,
            low_cpu_mem_usage=True,
            trust_remote_code=True,
        ).eval().to(device)

    tokenizer = AutoTokenizer.from_pretrained(
        model_name, trust_remote_code=True, use_fast=False
    )
    return model, tokenizer


def run_once(model, tokenizer, pixel_values: torch.Tensor, prompt: str, gen_cfg: dict):
    start = time.time()
    # Một số remote implementations của .chat mong đợi pixel_values ở device phù hợp
    response = model.chat(tokenizer, pixel_values, prompt, gen_cfg)
    dur = time.time() - start
    return response, dur


def main():
    parser = argparse.ArgumentParser(description="Vintern-1B quick tester")
    parser.add_argument("--model", type=str, default="5CD-AI/Vintern-1B-v3_5",
                        help="Hugging Face repo id của model.")
    parser.add_argument("--image", type=str, required=True,
                        help="Đường dẫn ảnh đầu vào để test.")
    parser.add_argument("--prompt", type=str, default="<image>\nMô tả hình ảnh một cách chi tiết trả về dạng markdown.",
                        help="Prompt đầu vào (có thể giữ <image> ở đầu).")
    parser.add_argument("--input-size", type=int, default=448,
                        help="Kích thước tile (mặc định 448).")
    parser.add_argument("--max-num", type=int, default=6,
                        help="Số tile tối đa (kèm thumbnail nếu phù hợp).")
    parser.add_argument("--no-thumbnail", action="store_true",
                        help="Tắt thêm thumbnail tile.")
    parser.add_argument("--num-beams", type=int, default=3, help="Beam search beams.")
    parser.add_argument("--max-new-tokens", type=int, default=512, help="Số token sinh thêm tối đa.")
    parser.add_argument("--repetition-penalty", type=float, default=3.5, help="Repetition penalty.")
    parser.add_argument("--sample", action="store_true", help="Bật sampling (do_sample=True).")
    parser.add_argument("--loop", type=int, default=1, help="Chạy lặp N lần để đo độ ổn định/latency.")
    parser.add_argument("--use-flash-attn", action="store_true", help="Thử bật use_flash_attn khi load model.")
    args = parser.parse_args()

    if not os.path.isfile(args.image):
        raise FileNotFoundError(f"Không tìm thấy ảnh: {args.image}")

    device, dtype = get_device_and_dtype()
    print(f"[INFO] Device: {device.type} | DType: {dtype} | CUDA: {torch.cuda.is_available()}")

    print(f"[INFO] Loading model: {args.model}")
    model, tokenizer = load_model_and_tokenizer(args.model, device, dtype, args.use_flash_attn)
    print("[INFO] Model loaded.")

    # Tải & chuẩn hóa ảnh
    use_thumbnail = not args.no_thumbnail
    if _HAVE_EXTERNAL_FUNCS:
        # Dùng lại pipeline từ script gốc nếu import được
        from vintern_infer import load_image as _external_load_image  # type: ignore
        pixel_values = _external_load_image(args.image, max_num=args.max_num)
    else:
        pixel_values = _load_image(args.image, input_size=args.input_size, max_num=args.max_num, use_thumbnail=use_thumbnail)

    # Chuyển dtype/device phù hợp
    if device.type == "cuda":
        pixel_values = pixel_values.to(dtype=torch.bfloat16, device=device)
    else:
        pixel_values = pixel_values.to(dtype=torch.float32, device=device)

    gen_cfg = dict(
        max_new_tokens=args.max_new_tokens,
        do_sample=bool(args.sample),
        num_beams=args.num_beams,
        repetition_penalty=args.repetition_penalty,
    )

    print(f"[INFO] Image: {args.image}")
    print(f"[INFO] Tiles: {pixel_values.shape[0]} | Each: {pixel_values.shape[-2]}x{pixel_values.shape[-1]}")
    print(f"[INFO] Generation cfg: {gen_cfg}")

    # Run N lần
    last_resp = None
    times = []
    for i in range(1, args.loop + 1):
        print(f"\n[RUN {i}/{args.loop}] Generating...")
        resp, dur = run_once(model, tokenizer, pixel_values, args.prompt, gen_cfg)
        times.append(dur)
        print(f"[RUN {i}] Latency: {dur:.3f}s")
        if isinstance(resp, str):
            # In ngắn gọn nếu quá dài
            preview = resp if len(resp) < 400 else (resp[:400] + " ...")
            print(f"[RUN {i}] Response preview:\n{preview}")
        else:
            print(f"[RUN {i}] Response (non-string): {type(resp)}")
        last_resp = resp

    if times:
        avg = sum(times) / len(times)
        print(f"\n[STATS] Runs: {len(times)} | Avg latency: {avg:.3f}s | Min: {min(times):.3f}s | Max: {max(times):.3f}s")

    # Simple assertion để đảm bảo có kết quả
    if isinstance(last_resp, str) and len(last_resp.strip()) > 0:
        print("\n[RESULT] ✅ Model trả về chuỗi hợp lệ.")
    else:
        print("\n[RESULT] ⚠️ Model không trả về chuỗi hợp lệ hoặc rỗng.")


if __name__ == "__main__":
    main()

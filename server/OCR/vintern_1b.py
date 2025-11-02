#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vintern-1B Inference Script
Standalone script for running Vintern-1B vision-language model

Install Dependencies:
pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision
pip install pillow transformers==4.37.2
"""

import torch
import torchvision.transforms as T
from PIL import Image
from torchvision.transforms.functional import InterpolationMode
from transformers import AutoModel, AutoTokenizer

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def build_transform(input_size):
    """Build image transformation pipeline"""
    transform = T.Compose([
        T.Lambda(lambda img: img.convert('RGB') if img.mode != 'RGB' else img),
        T.Resize((input_size, input_size), interpolation=InterpolationMode.BICUBIC),
        T.ToTensor(),
        T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])
    return transform


def find_closest_aspect_ratio(aspect_ratio, target_ratios, width, height, image_size):
    """Find the closest aspect ratio from target ratios"""
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


def dynamic_preprocess(image, min_num=1, max_num=12, image_size=448, use_thumbnail=False):
    """Dynamically preprocess image into multiple patches"""
    orig_width, orig_height = image.size
    aspect_ratio = orig_width / orig_height

    # Calculate target aspect ratios
    target_ratios = set(
        (i, j) for n in range(min_num, max_num + 1) 
        for i in range(1, n + 1) 
        for j in range(1, n + 1) 
        if i * j <= max_num and i * j >= min_num
    )
    target_ratios = sorted(target_ratios, key=lambda x: x[0] * x[1])

    # Find closest aspect ratio
    target_aspect_ratio = find_closest_aspect_ratio(
        aspect_ratio, target_ratios, orig_width, orig_height, image_size
    )

    # Calculate target dimensions
    target_width = image_size * target_aspect_ratio[0]
    target_height = image_size * target_aspect_ratio[1]
    blocks = target_aspect_ratio[0] * target_aspect_ratio[1]

    # Resize and split image
    resized_img = image.resize((target_width, target_height))
    processed_images = []
    
    for i in range(blocks):
        box = (
            (i % (target_width // image_size)) * image_size,
            (i // (target_width // image_size)) * image_size,
            ((i % (target_width // image_size)) + 1) * image_size,
            ((i // (target_width // image_size)) + 1) * image_size
        )
        split_img = resized_img.crop(box)
        processed_images.append(split_img)
    
    if use_thumbnail and len(processed_images) != 1:
        thumbnail_img = image.resize((image_size, image_size))
        processed_images.append(thumbnail_img)
    
    return processed_images


def load_image(image_file, input_size=448, max_num=12):
    """Load and preprocess image"""
    image = Image.open(image_file).convert('RGB')
    transform = build_transform(input_size=input_size)
    images = dynamic_preprocess(image, image_size=input_size, use_thumbnail=True, max_num=max_num)
    pixel_values = [transform(image) for image in images]
    pixel_values = torch.stack(pixel_values)
    return pixel_values


def main():
    # Model configuration
    model_name = "5CD-AI/Vintern-1B-v3_5"
    
    # Load model
    print("Loading model...")
    try:
        model = AutoModel.from_pretrained(
            model_name,
            torch_dtype=torch.bfloat16,
            low_cpu_mem_usage=True,
            trust_remote_code=True,
            use_flash_attn=False,
        ).eval().cuda()
    except:
        model = AutoModel.from_pretrained(
            model_name,
            torch_dtype=torch.bfloat16,
            low_cpu_mem_usage=True,
            trust_remote_code=True
        ).eval().cuda()
    
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True, use_fast=False)
    print("Model loaded successfully!")
    
    image_path = "your_image.jpg"
    
    print(f"Processing image: {image_path}")
    pixel_values = load_image(image_path, max_num=6).to(torch.bfloat16).cuda()
    
    # Generation configuration
    generation_config = dict(
        max_new_tokens=512,
        do_sample=False,
        num_beams=3,
        repetition_penalty=3.5
    )
    
    question = """<image>\nExtract only the exact text visible in this comic/manga page.
    No descriptions, no summaries, no JSON, no quotes, no translation.
    Preserve original casing, punctuation, and line breaks.
    Reading direction = RTL (panel order as specified).
    Order: speech balloons → narration → SFX. Illegible → [illegible].
    If no text → EMPTY.
    Output only between:
    <RAW_TEXT_ONLY>
    ...transcription...
    </RAW_TEXT_ONLY>"""
    
    # Generate response
    print("\nGenerating response...")
    response = model.chat(tokenizer, pixel_values, question, generation_config)
    
    print(f'\nUser: {question}\nAssistant: {response}')


if __name__ == "__main__":
    main()
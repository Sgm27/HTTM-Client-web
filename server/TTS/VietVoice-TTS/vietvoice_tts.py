"""
Simple CLI to synthesize Vietnamese speech to a WAV file using VietVoice-TTS.

Quick usage examples:
  # 1) Minimal usage with default options (female, northern, neutral)
  cd VietVoice-TTS
  python vietvoice_tts.py --text "Xin chào thế giới" --out output.wav

  # 2) Change gender and area
  python vietvoice_tts.py \
    --text "Chúc bạn một ngày tốt lành" \
    --gender male \
    --area southern \
    --out southern_male.wav

  # 3) Use a different emotion style
  python vietvoice_tts.py \
    --text "Tôi rất vui được gặp bạn" \
    --emotion happy \
    --out happy_female_northern.wav

  # 4) Combine gender, area, and emotion
  python vietvoice_tts.py \
    --text "Xin lỗi vì sự chậm trễ" \
    --gender female \
    --area central \
    --emotion sad \
    --out central_female_sad.wav

  # 5) Read input from a UTF-8 text file
  python vietvoice_tts.py \
    --text-file dataset/transcripts/example.txt \
    --gender male \
    --area northern \
    --emotion neutral \
    --out from_file.wav
"""

import argparse
import os
from typing import Optional


def import_vietvoice_or_raise():
    try:
        # Lazy import so we can give a nicer error if missing
        from vietvoicetts import synthesize  # type: ignore
        return synthesize
    except Exception as exc:  # pragma: no cover - friendly error message
        raise RuntimeError(
            "Cannot import 'vietvoicetts'. Please install VietVoice-TTS first, "
            "for example: pip install vietvoicetts or per project instructions."
        ) from exc


def synthesize_text_to_wav(
    text: str,
    out_file_path: str,
    gender: str = "female",
    area: str = "northern",
    emotion: str = "neutral",
) -> float:
    """Synthesize given text to a WAV file and return duration in seconds."""
    if not isinstance(text, str) or len(text.strip()) == 0:
        raise ValueError("Input text must be a non-empty string.")

    output_directory = os.path.dirname(os.path.abspath(out_file_path))
    if output_directory and not os.path.exists(output_directory):
        os.makedirs(output_directory, exist_ok=True)

    synthesize = import_vietvoice_or_raise()

    duration_seconds: float = synthesize(
        text.strip(),
        out_file_path,
        gender=gender,
        area=area,
        emotion=emotion,
    )
    return float(duration_seconds)


def read_text_from_file(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8") as file_handle:
        return file_handle.read()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Synthesize Vietnamese speech to WAV using VietVoice-TTS",
    )
    text_group = parser.add_mutually_exclusive_group(required=True)
    text_group.add_argument(
        "--text",
        type=str,
        help="Input text to synthesize",
    )
    text_group.add_argument(
        "--text-file",
        type=str,
        help="Path to a UTF-8 text file containing the input text",
    )
    parser.add_argument(
        "--out",
        type=str,
        default=os.path.join("output.wav"),
        help="Output WAV file path (default: output.wav)",
    )
    parser.add_argument(
        "--gender",
        type=str,
        choices=["female", "male"],
        default="female",
        help="Voice gender (default: female)",
    )
    parser.add_argument(
        "--area",
        type=str,
        choices=["northern", "central", "southern"],
        default="northern",
        help="Accent area (default: northern)",
    )
    parser.add_argument(
        "--emotion",
        type=str,
        choices=["neutral", "happy", "sad", "angry"],
        default="neutral",
        help="Emotion style (default: neutral)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_text: Optional[str] = args.text
    if args.text_file:
        input_text = read_text_from_file(args.text_file)

    assert input_text is not None  # for type checkers; mutually exclusive group ensures one

    duration = synthesize_text_to_wav(
        text=input_text,
        out_file_path=args.out,
        gender=args.gender,
        area=args.area,
        emotion=args.emotion,
    )

    print(
        f"WAV generated: {os.path.abspath(args.out)} | duration: {duration:.2f} seconds"
    )


if __name__ == "__main__":
    main()
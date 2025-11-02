"""
VietVoice TTS API wrapper for integration with TTS service
"""
import sys
import os
from typing import Optional

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from vietvoicetts import synthesize as vietvoice_synthesize


def synthesize_vietvoice(
    text: str,
    output_path: str,
    gender: str = "female",
    area: str = "central",
    emotion: str = "neutral"
) -> float:
    """
    Synthesize speech using VietVoice TTS
    
    Args:
        text: Text to synthesize
        output_path: Path to save output WAV file
        gender: Voice gender ("male" or "female")
        area: Voice area ("northern", "central", or "southern")
        emotion: Voice emotion ("neutral", "happy", "sad", "angry", "surprised")
    
    Returns:
        Duration of generated audio in seconds
    
    Raises:
        Exception: If synthesis fails
    """
    duration = vietvoice_synthesize(
        text=text,
        gender=gender,
        area=area,
        emotion=emotion,
        output_path=output_path
    )
    return duration


if __name__ == "__main__":
    # Simple test
    duration = synthesize_vietvoice(
        text="Xin chào các bạn! Đây là ví dụ cơ bản về tổng hợp giọng nói tiếng Việt.",
        gender="female",
        area="central",
        emotion="sad",
        output_path="greeting.wav"
    )
    print(f"Generated audio: {duration:.2f} seconds")
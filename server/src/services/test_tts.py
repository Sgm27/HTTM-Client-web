"""
Test script for TTS Service
Tests various functionalities of the TTS service including:
- Model loading
- Text synthesis
- Error handling
- Audio output validation
"""

import os
import sys
import wave
import asyncio
from pathlib import Path

# Add parent directory to path to import tts service
sys.path.append(str(Path(__file__).parent.parent.parent))

from src.services.tts import TTSService


class TTSServiceTester:
    """Test suite for TTS Service"""
    
    def __init__(self):
        self.tts_service = TTSService(
            model_name="sonktx/mms-tts-vie-finetuned",
            prefer_gpu=True,
            fallback_on_oom=True,
            cuda_device="cuda",
            max_chars=1000,
        )
        self.test_results = []
        
    def log_test(self, test_name: str, passed: bool, message: str = ""):
        """Log test result"""
        status = "✓ PASSED" if passed else "✗ FAILED"
        result = f"{status}: {test_name}"
        if message:
            result += f" - {message}"
        print(result)
        self.test_results.append((test_name, passed, message))
        
    def test_01_model_loading(self):
        """Test 1: Check if model loads successfully"""
        test_name = "Model Loading"
        try:
            self.tts_service.load()
            
            # Verify model is loaded
            assert self.tts_service._initialized, "Model not initialized"
            assert self.tts_service._model is not None, "Model is None"
            assert self.tts_service._tokenizer is not None, "Tokenizer is None"
            assert self.tts_service._device is not None, "Device is None"
            
            device_info = f"Device: {self.tts_service._device}"
            self.log_test(test_name, True, device_info)
            return True
            
        except Exception as e:
            self.log_test(test_name, False, str(e))
            return False
    
    async def test_02_basic_synthesis(self):
        """Test 2: Basic text-to-speech synthesis"""
        test_name = "Basic Synthesis"
        test_text = "Xin chào, đây là bài kiểm tra hệ thống chuyển văn bản thành giọng nói."
        
        try:
            response = await self.tts_service.synthesize(test_text)
            
            # Verify response
            assert response is not None, "Response is None"
            assert hasattr(response, 'path'), "Response has no path"
            assert os.path.exists(response.path), "Output file does not exist"
            
            # Check if file is valid WAV
            with wave.open(response.path, 'rb') as wav_file:
                channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                framerate = wav_file.getframerate()
                frames = wav_file.getnframes()
                duration = frames / float(framerate)
                
                assert channels == 1, f"Expected 1 channel, got {channels}"
                assert sample_width == 2, f"Expected 2 bytes sample width, got {sample_width}"
                assert duration > 0, "Audio duration is 0"
                
                info = f"Duration: {duration:.2f}s, Rate: {framerate}Hz"
                self.log_test(test_name, True, info)
                
            # Cleanup
            if os.path.exists(response.path):
                os.remove(response.path)
                
            return True
            
        except Exception as e:
            self.log_test(test_name, False, str(e))
            return False
    
    async def test_03_vietnamese_text(self):
        """Test 3: Synthesis with various Vietnamese texts"""
        test_name = "Vietnamese Text Synthesis"
        
        vietnamese_texts = [
            "Chào mừng bạn đến với hệ thống thông minh.",
            "Tôi có thể đọc tiếng Việt có dấu một cách chính xác.",
            "Đây là một câu dài hơn với nhiều từ và dấu câu khác nhau, bao gồm cả dấu phẩy và dấu chấm.",
        ]
        
        try:
            for i, text in enumerate(vietnamese_texts, 1):
                response = await self.tts_service.synthesize(text)
                assert response is not None, f"Response is None for text {i}"
                assert os.path.exists(response.path), f"File not created for text {i}"
                
                # Cleanup
                if os.path.exists(response.path):
                    os.remove(response.path)
            
            self.log_test(test_name, True, f"Successfully synthesized {len(vietnamese_texts)} Vietnamese texts")
            return True
            
        except Exception as e:
            self.log_test(test_name, False, str(e))
            return False
    
    async def test_04_empty_text_handling(self):
        """Test 4: Error handling for empty text"""
        test_name = "Empty Text Handling"
        
        try:
            # Test empty string
            try:
                await self.tts_service.synthesize("")
                self.log_test(test_name, False, "Should have raised exception for empty text")
                return False
            except Exception:
                pass  # Expected
            
            # Test whitespace only
            try:
                await self.tts_service.synthesize("   ")
                self.log_test(test_name, False, "Should have raised exception for whitespace-only text")
                return False
            except Exception:
                pass  # Expected
                
            self.log_test(test_name, True, "Properly handled empty/whitespace text")
            return True
            
        except Exception as e:
            self.log_test(test_name, False, str(e))
            return False
    
    async def test_05_long_text_handling(self):
        """Test 5: Handling of long text (exceeding max_chars)"""
        test_name = "Long Text Handling"
        
        try:
            # Create text longer than max_chars (1000)
            long_text = "Đây là một câu rất dài. " * 50  # ~1200+ characters
            
            try:
                await self.tts_service.synthesize(long_text)
                self.log_test(test_name, False, "Should have raised exception for text exceeding max_chars")
                return False
            except Exception as e:
                if "too long" in str(e).lower() or "413" in str(e):
                    self.log_test(test_name, True, "Properly rejected text exceeding max_chars")
                    return True
                else:
                    self.log_test(test_name, False, f"Unexpected error: {e}")
                    return False
                    
        except Exception as e:
            self.log_test(test_name, False, str(e))
            return False
    
    async def test_06_special_characters(self):
        """Test 6: Handling text with numbers and special characters"""
        test_name = "Special Characters Handling"
        
        texts_with_special_chars = [
            "Số điện thoại của tôi là 0123456789",
            "Email: test@example.com",
            "Giá: 100,000 VNĐ",
        ]
        
        try:
            for text in texts_with_special_chars:
                response = await self.tts_service.synthesize(text)
                assert response is not None, f"Failed to synthesize: {text}"
                
                # Cleanup
                if os.path.exists(response.path):
                    os.remove(response.path)
            
            self.log_test(test_name, True, f"Successfully handled {len(texts_with_special_chars)} texts with special characters")
            return True
            
        except Exception as e:
            self.log_test(test_name, False, str(e))
            return False
    
    async def test_07_concurrent_synthesis(self):
        """Test 7: Concurrent synthesis requests"""
        test_name = "Concurrent Synthesis"
        
        try:
            texts = [
                "Đây là yêu cầu thứ nhất",
                "Đây là yêu cầu thứ hai",
                "Đây là yêu cầu thứ ba",
            ]
            
            # Run synthesis concurrently
            tasks = [self.tts_service.synthesize(text) for text in texts]
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Check responses
            success_count = 0
            for i, response in enumerate(responses):
                if isinstance(response, Exception):
                    print(f"  Request {i+1} failed: {response}")
                else:
                    success_count += 1
                    if os.path.exists(response.path):
                        os.remove(response.path)
            
            if success_count == len(texts):
                self.log_test(test_name, True, f"Successfully handled {success_count} concurrent requests")
                return True
            else:
                self.log_test(test_name, False, f"Only {success_count}/{len(texts)} requests succeeded")
                return False
                
        except Exception as e:
            self.log_test(test_name, False, str(e))
            return False
    
    async def test_08_audio_quality_check(self):
        """Test 8: Check audio output quality"""
        test_name = "Audio Quality Check"
        test_text = "Kiểm tra chất lượng âm thanh đầu ra"
        
        try:
            response = await self.tts_service.synthesize(test_text)
            
            # Read and analyze audio file
            with wave.open(response.path, 'rb') as wav_file:
                framerate = wav_file.getframerate()
                frames = wav_file.getnframes()
                duration = frames / float(framerate)
                
                # Check minimum quality standards
                assert framerate >= 16000, f"Sample rate too low: {framerate}Hz"
                assert duration >= 0.5, f"Audio too short: {duration}s"
                assert duration <= 30, f"Audio too long: {duration}s"
                
                info = f"Quality OK - {framerate}Hz, {duration:.2f}s"
                self.log_test(test_name, True, info)
            
            # Cleanup
            if os.path.exists(response.path):
                os.remove(response.path)
                
            return True
            
        except Exception as e:
            self.log_test(test_name, False, str(e))
            return False
    
    async def test_09_save_sample_audio(self):
        """Test 9: Generate and save sample audio files for listening"""
        test_name = "Save Sample Audio Files"
        
        # Create output directory
        output_dir = Path(__file__).parent.parent.parent / "test_audio_samples"
        output_dir.mkdir(exist_ok=True)
        
        sample_texts = [
            ("sample_01_greeting.wav", "Xin chào, tôi là hệ thống chuyển văn bản thành giọng nói tiếng Việt."),
            ("sample_02_introduction.wav", "Đây là hệ thống thông minh sử dụng trí tuệ nhân tạo để đọc văn bản tiếng Việt một cách tự nhiên."),
            ("sample_03_long_text.wav", "Công nghệ chuyển văn bản thành giọng nói đã phát triển rất nhiều trong những năm gần đây. Hiện nay, các hệ thống có thể tạo ra giọng nói gần như tự nhiên với nhiều ngôn ngữ khác nhau."),
            ("sample_04_numbers.wav", "Số điện thoại của tôi là 0123456789. Email liên hệ là example@email.com"),
            ("sample_05_story.wav", "Ngày xửa ngày xưa, có một cô bé tên là Hoa. Cô bé sống trong một ngôi làng nhỏ ở chân núi. Mỗi ngày, cô đều đi học và giúp đỡ gia đình."),
        ]
        
        try:
            saved_files = []
            for filename, text in sample_texts:
                response = await self.tts_service.synthesize(text)
                
                # Copy to output directory with proper name
                output_path = output_dir / filename
                
                # Read original file and write to new location
                with wave.open(response.path, 'rb') as src:
                    params = src.getparams()
                    frames = src.readframes(src.getnframes())
                    
                with wave.open(str(output_path), 'wb') as dst:
                    dst.setparams(params)
                    dst.writeframes(frames)
                
                saved_files.append(str(output_path))
                
                # Cleanup original temp file
                if os.path.exists(response.path):
                    os.remove(response.path)
            
            info = f"Saved {len(saved_files)} sample files to: {output_dir}"
            self.log_test(test_name, True, info)
            
            print(f"\n📁 Sample audio files saved to: {output_dir}")
            print("   Files:")
            for file in saved_files:
                file_size = os.path.getsize(file) / 1024  # KB
                print(f"   - {Path(file).name} ({file_size:.1f} KB)")
            
            return True
            
        except Exception as e:
            self.log_test(test_name, False, str(e))
            return False
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for _, passed, _ in self.test_results if passed)
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        print("="*60)
        
        if failed_tests > 0:
            print("\nFailed Tests:")
            for test_name, passed, message in self.test_results:
                if not passed:
                    print(f"  - {test_name}: {message}")


async def main():
    """Main test runner"""
    print("="*60)
    print("TTS SERVICE TEST SUITE")
    print("="*60)
    print()
    
    tester = TTSServiceTester()
    
    # Run tests sequentially
    print("Running tests...\n")
    
    # Test 1: Model loading
    if not tester.test_01_model_loading():
        print("\n⚠ Model loading failed. Stopping tests.")
        return
    
    # Test 2-9: Synthesis tests
    await tester.test_02_basic_synthesis()
    await tester.test_03_vietnamese_text()
    await tester.test_04_empty_text_handling()
    await tester.test_05_long_text_handling()
    await tester.test_06_special_characters()
    await tester.test_07_concurrent_synthesis()
    await tester.test_08_audio_quality_check()
    await tester.test_09_save_sample_audio()
    
    # Print summary
    tester.print_summary()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user.")
    except Exception as e:
        print(f"\n\nTest suite failed with error: {e}")
        import traceback
        traceback.print_exc()

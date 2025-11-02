#!/usr/bin/env python3
"""
Script để test TTS endpoint
Sử dụng: python test_tts_endpoint.py
"""

import requests
import os
from pathlib import Path

# Cấu hình
BASE_URL = "https://backend-httm-client.sonktx.online"  # Thay đổi nếu server chạy ở port khác
API_PREFIX = "/api"  # Dựa theo cấu hình trong main.py
TTS_ENDPOINT = f"{BASE_URL}{API_PREFIX}/tts"

# Thư mục lưu file audio output
OUTPUT_DIR = Path("test_audio_samples")
OUTPUT_DIR.mkdir(exist_ok=True)


def test_tts_simple():
    """Test TTS với văn bản đơn giản"""
    print("\n" + "="*60)
    print("TEST 1: Văn bản đơn giản")
    print("="*60)
    
    text = "Xin chào, đây là bài test text to speech."
    
    try:
        response = requests.post(
            TTS_ENDPOINT,
            data={"text": text}
        )
        
        if response.status_code == 200:
            # Lưu file audio
            output_file = OUTPUT_DIR / "test_simple.wav"
            with open(output_file, "wb") as f:
                f.write(response.content)
            
            # Lấy thông tin duration từ header
            duration = response.headers.get("X-Audio-Duration", "Unknown")
            
            print(f"✅ PASS - Đã tạo file: {output_file}")
            print(f"   Duration: {duration}s")
            print(f"   File size: {len(response.content)} bytes")
        else:
            print(f"❌ FAIL - Status code: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ ERROR - {str(e)}")


def test_tts_vietnamese():
    """Test TTS với văn bản tiếng Việt phức tạp"""
    print("\n" + "="*60)
    print("TEST 2: Văn bản tiếng Việt phức tạp")
    print("="*60)
    
    text = """
    Việt Nam là một quốc gia nằm ở phía đông bán đảo Đông Dương, 
    thuộc khu vực Đông Nam Á. Đất nước có hình chữ S với diện tích 
    khoảng 331.212 km vuông và dân số hơn 97 triệu người.
    """
    
    try:
        response = requests.post(
            TTS_ENDPOINT,
            data={"text": text}
        )
        
        if response.status_code == 200:
            output_file = OUTPUT_DIR / "test_vietnamese.wav"
            with open(output_file, "wb") as f:
                f.write(response.content)
            
            duration = response.headers.get("X-Audio-Duration", "Unknown")
            
            print(f"✅ PASS - Đã tạo file: {output_file}")
            print(f"   Duration: {duration}s")
            print(f"   File size: {len(response.content)} bytes")
        else:
            print(f"❌ FAIL - Status code: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ ERROR - {str(e)}")


def test_tts_long_text():
    """Test TTS với văn bản dài"""
    print("\n" + "="*60)
    print("TEST 3: Văn bản dài")
    print("="*60)
    
    text = """
    Hà Nội là thủ đô của nước Cộng hòa xã hội chủ nghĩa Việt Nam và là 
    trung tâm chính trị, văn hóa của cả nước. Hà Nội có lịch sử phát triển 
    lâu đời, từng là kinh đô của nhiều triều đại phong kiến Việt Nam. 
    Thành phố nằm ở vùng châu thổ sông Hồng, có diện tích tự nhiên hơn 
    3.300 km vuông và dân số khoảng 8 triệu người. Hà Nội nổi tiếng với 
    nhiều di tích lịch sử, văn hóa như Văn Miếu Quốc Tử Giám, Hoàng Thành 
    Thăng Long, Chùa Một Cột, Hồ Hoàn Kiếm. Thành phố cũng là trung tâm 
    giáo dục với nhiều trường đại học hàng đầu của cả nước.
    """
    
    try:
        response = requests.post(
            TTS_ENDPOINT,
            data={"text": text}
        )
        
        if response.status_code == 200:
            output_file = OUTPUT_DIR / "test_long_text.wav"
            with open(output_file, "wb") as f:
                f.write(response.content)
            
            duration = response.headers.get("X-Audio-Duration", "Unknown")
            
            print(f"✅ PASS - Đã tạo file: {output_file}")
            print(f"   Duration: {duration}s")
            print(f"   File size: {len(response.content)} bytes")
        else:
            print(f"❌ FAIL - Status code: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ ERROR - {str(e)}")


def test_tts_empty_text():
    """Test TTS với văn bản rỗng (expected to fail)"""
    print("\n" + "="*60)
    print("TEST 4: Văn bản rỗng (nên báo lỗi)")
    print("="*60)
    
    try:
        response = requests.post(
            TTS_ENDPOINT,
            data={"text": ""}
        )
        
        if response.status_code == 400:
            print(f"✅ PASS - Đã báo lỗi đúng với status code 400")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ FAIL - Expected status 400, got {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ ERROR - {str(e)}")


def test_tts_special_chars():
    """Test TTS với ký tự đặc biệt"""
    print("\n" + "="*60)
    print("TEST 5: Văn bản có ký tự đặc biệt")
    print("="*60)
    
    text = "Số điện thoại: 0123-456-789. Email: test@example.com. Giá: 100.000đ!"
    
    try:
        response = requests.post(
            TTS_ENDPOINT,
            data={"text": text}
        )
        
        if response.status_code == 200:
            output_file = OUTPUT_DIR / "test_special_chars.wav"
            with open(output_file, "wb") as f:
                f.write(response.content)
            
            duration = response.headers.get("X-Audio-Duration", "Unknown")
            
            print(f"✅ PASS - Đã tạo file: {output_file}")
            print(f"   Duration: {duration}s")
            print(f"   File size: {len(response.content)} bytes")
        else:
            print(f"❌ FAIL - Status code: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ ERROR - {str(e)}")


def test_server_connection():
    """Kiểm tra kết nối đến server"""
    print("\n" + "="*60)
    print("KIỂM TRA KẾT NỐI SERVER")
    print("="*60)
    
    try:
        # Thử gọi health endpoint
        health_url = f"{BASE_URL}{API_PREFIX}/health"
        response = requests.get(health_url, timeout=5)
        
        if response.status_code == 200:
            print(f"✅ Server đang chạy tại {BASE_URL}")
            return True
        else:
            print(f"⚠️  Server phản hồi nhưng status code: {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"❌ Không thể kết nối đến server tại {BASE_URL}")
        print(f"   Hãy đảm bảo server đang chạy:")
        print(f"   cd server && uvicorn src.main:app --reload")
        return False
    except Exception as e:
        print(f"❌ Lỗi khi kiểm tra kết nối: {str(e)}")
        return False


def main():
    """Chạy tất cả các test"""
    print("\n" + "="*60)
    print("BẮT ĐẦU TEST TTS ENDPOINT")
    print("="*60)
    print(f"Server URL: {BASE_URL}")
    print(f"TTS Endpoint: {TTS_ENDPOINT}")
    print(f"Output directory: {OUTPUT_DIR.absolute()}")
    
    # Kiểm tra kết nối trước
    if not test_server_connection():
        return
    
    # Chạy các test
    test_tts_simple()
    test_tts_vietnamese()
    test_tts_long_text()
    test_tts_empty_text()
    test_tts_special_chars()
    
    print("\n" + "="*60)
    print("HOÀN THÀNH TẤT CẢ TEST")
    print("="*60)
    print(f"\nCác file audio đã được lưu tại: {OUTPUT_DIR.absolute()}")
    print("Bạn có thể mở và nghe các file .wav để kiểm tra chất lượng.")


if __name__ == "__main__":
    main()

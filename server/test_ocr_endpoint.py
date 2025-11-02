"""
test_ocr_endpoint.py - Test OCR endpoint với ảnh cục bộ

Chạy:
  python test_ocr_endpoint.py --image path/to/your_image.jpg
  python test_ocr_endpoint.py --image path/to/your_image.jpg --url http://localhost:8000
"""

import argparse
import requests
import os
import json
from pathlib import Path


def test_ocr_endpoint(image_path: str, base_url: str = "https://backend-httm-client.sonktx.online"):
    """
    Test OCR endpoint bằng cách gửi ảnh và nhận kết quả

    Args:
        image_path: Đường dẫn đến file ảnh
        base_url: URL của server (mặc định: http://localhost:8000)
    """
    # Kiểm tra file tồn tại
    if not os.path.isfile(image_path):
        print(f"❌ Lỗi: Không tìm thấy file ảnh: {image_path}")
        return

    # Kiểm tra extension
    valid_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
    file_ext = Path(image_path).suffix.lower()
    if file_ext not in valid_extensions:
        print(f"⚠️  Cảnh báo: Extension {file_ext} có thể không được hỗ trợ")

    print(f"📤 Đang gửi ảnh: {image_path}")
    print(f"🌐 Đến server: {base_url}")
    print("-" * 60)

    # Endpoint URL
    ocr_url = f"{base_url}/api/ocr/extract"

    try:
        # Mở và gửi file
        with open(image_path, 'rb') as f:
            files = {'file': (os.path.basename(image_path), f, f'image/{file_ext[1:]}')}
            
            print("⏳ Đang xử lý OCR (có thể mất vài giây)...")
            response = requests.post(ocr_url, files=files, timeout=120)

        # Kiểm tra status code
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ OCR thành công!\n")
            
            # Parse JSON response
            try:
                result = response.json()
                
                # In kết quả
                print("=" * 60)
                print("KẾT QUẢ OCR:")
                print("=" * 60)
                
                if 'text' in result:
                    print(result['text'])
                elif 'extracted_text' in result:
                    print(result['extracted_text'])
                else:
                    print(json.dumps(result, indent=2, ensure_ascii=False))
                
                print("=" * 60)
                
                # Thông tin thêm nếu có
                if 'processing_time' in result:
                    print(f"\n⏱️  Thời gian xử lý: {result['processing_time']:.2f}s")
                if 'confidence' in result:
                    print(f"🎯 Độ tin cậy: {result['confidence']:.2%}")
                
            except json.JSONDecodeError:
                print("⚠️  Response không phải JSON:")
                print(response.text[:500])
                
        elif response.status_code == 400:
            print("❌ Lỗi: Yêu cầu không hợp lệ")
            print(f"Chi tiết: {response.text}")
            
        elif response.status_code == 413:
            print("❌ Lỗi: File quá lớn")
            print(f"Kích thước file: {os.path.getsize(image_path) / 1024 / 1024:.2f} MB")
            
        elif response.status_code == 500:
            print("❌ Lỗi server:")
            print(response.text)
            
        else:
            print(f"❌ Lỗi không xác định:")
            print(response.text)

    except requests.exceptions.ConnectionError:
        print(f"❌ Không thể kết nối đến server: {base_url}")
        print("💡 Kiểm tra xem server đã chạy chưa?")
        
    except requests.exceptions.Timeout:
        print("❌ Timeout: Server mất quá lâu để phản hồi")
        print("💡 Thử tăng timeout hoặc kiểm tra server")
        
    except Exception as e:
        print(f"❌ Lỗi không mong muốn: {str(e)}")


def main():
    parser = argparse.ArgumentParser(
        description="Test OCR endpoint với ảnh cục bộ",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  python test_ocr_endpoint.py --image sample.jpg
  python test_ocr_endpoint.py --image /path/to/comic.png --url http://localhost:8000
  python test_ocr_endpoint.py --image ../sample\ data/chuong1.jpg
        """
    )
    
    parser.add_argument(
        "--image", 
        type=str, 
        required=True, 
        help="Đường dẫn đến file ảnh cần OCR"
    )
    
    parser.add_argument(
        "--url", 
        type=str, 
        default="http://localhost:8000",
        help="Base URL của server (mặc định: http://localhost:8000)"
    )
    
    args = parser.parse_args()
    
    # Chuyển đổi đường dẫn tương đối thành tuyệt đối
    image_path = os.path.abspath(args.image)
    
    test_ocr_endpoint(image_path, args.url)


if __name__ == "__main__":
    main()

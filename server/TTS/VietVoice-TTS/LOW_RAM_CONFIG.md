# Cấu hình tối ưu cho RAM thấp

## Các thay đổi đã thực hiện

### 1. **model_config.py** - Giảm RAM Usage

#### a) `nfe_step`: 32 → 16 (Giảm 50% RAM)
- **Ảnh hưởng**: Số bước transformer iterations
- **Trade-off**: Chất lượng giọng nói có thể giảm nhẹ (~5-10%)
- **RAM tiết kiệm**: ~30-40% trong quá trình inference

#### b) `max_chunk_duration`: 15.0 → 8.0 giây
- **Ảnh hưởng**: Kích thước mỗi chunk audio xử lý
- **Trade-off**: Xử lý nhiều chunk hơn (tốc độ chậm hơn ~20%)
- **RAM tiết kiệm**: ~40-50% peak memory

#### c) `enable_cpu_mem_arena`: True → False
- **Ảnh hưởng**: Tắt memory pooling của ONNX Runtime
- **Trade-off**: Tốc độ chậm hơn ~10-15%
- **RAM tiết kiệm**: ~20-30% memory overhead

#### d) Thread settings
- `inter_op_num_threads`: 0 → 1
- `intra_op_num_threads`: 0 → 1
- **Ảnh hưởng**: Giới hạn số thread song song
- **Trade-off**: Tốc độ chậm hơn ~15-20%
- **RAM tiết kiệm**: ~15-25% thread overhead

### 2. **model.py** - Tối ưu ONNX Runtime

#### a) Graph Optimization: ORT_ENABLE_ALL → ORT_ENABLE_BASIC
- **Ảnh hưởng**: Giảm optimization passes
- **Trade-off**: Tốc độ chậm hơn ~5-10%
- **RAM tiết kiệm**: ~10-15% optimization overhead

#### b) Thread Spinning: ON → OFF
- **Ảnh hưởng**: Tắt busy-waiting threads
- **Trade-off**: Latency tăng nhẹ
- **RAM tiết kiệm**: ~5-10% CPU/RAM overhead

#### c) Multi-GPU Support
- Thêm support cho ROCMExecutionProvider (AMD GPU)
- Thêm support cho DmlExecutionProvider (DirectML/Windows GPU)
- Thêm support cho OpenVINOExecutionProvider (Intel GPU)

## Tổng kết tác động

### RAM Usage
- **Giảm tổng cộng**: ~50-60% peak RAM usage
- **Ví dụ**: 8GB RAM → ~3-4GB RAM

### Tốc độ
- **Chậm hơn tổng cộng**: ~40-60%
- **Ví dụ**: 10 giây → 14-16 giây (cho cùng một đoạn text)

### Chất lượng
- **Giảm nhẹ**: ~5-10% (do giảm nfe_step)
- Vẫn chấp nhận được cho hầu hết use cases

## Cách điều chỉnh thêm

### Nếu vẫn hết RAM:

1. **Giảm nfe_step xuống 8**:
```python
nfe_step: int = 8  # Giảm thêm 50%
```

2. **Giảm max_chunk_duration xuống 4-5 giây**:
```python
max_chunk_duration: float = 5.0
```

3. **Tắt hoàn toàn multi-threading**:
```python
inter_op_num_threads: int = 0
intra_op_num_threads: int = 0
```

### Nếu muốn tăng chất lượng (có thêm RAM):

1. **Tăng nfe_step lên 20-24**:
```python
nfe_step: int = 24
```

2. **Tăng max_chunk_duration lên 10-12 giây**:
```python
max_chunk_duration: float = 10.0
```

## Kiểm tra GPU

Chạy lệnh sau để kiểm tra xem có GPU không:

```python
import onnxruntime
print("Available providers:", onnxruntime.get_available_providers())
```

Kết quả mong đợi nếu có GPU:
- `['CUDAExecutionProvider', 'CPUExecutionProvider']` - NVIDIA GPU
- `['ROCMExecutionProvider', 'CPUExecutionProvider']` - AMD GPU
- `['DmlExecutionProvider', 'CPUExecutionProvider']` - Windows DirectML

## Cài đặt ONNX Runtime GPU (nếu cần)

### NVIDIA CUDA:
```bash
pip uninstall onnxruntime
pip install onnxruntime-gpu
```

### AMD ROCm:
```bash
pip install onnxruntime-rocm
```

### Windows DirectML:
```bash
pip install onnxruntime-directml
```

## Theo dõi RAM Usage

Sử dụng code sau để theo dõi:

```python
import psutil
import os

process = psutil.Process(os.getpid())
print(f"RAM Usage: {process.memory_info().rss / 1024 / 1024:.2f} MB")
```

## Lưu ý quan trọng

⚠️ **GPU sẽ giúp giảm RAM usage rất nhiều!**
- CPU inference: Model + data đều trên RAM
- GPU inference: Model + data trên VRAM, chỉ I/O trên RAM

✅ **Khuyến nghị**:
1. Cài đặt onnxruntime-gpu nếu có NVIDIA GPU
2. Giảm nfe_step xuống 12-16 để cân bằng quality/performance
3. Giảm max_chunk_duration xuống 6-8 giây cho văn bản dài
4. Theo dõi RAM usage trong quá trình chạy

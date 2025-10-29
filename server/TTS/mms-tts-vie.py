from transformers import VitsModel, AutoTokenizer
import torch
from scipy.io import wavfile
import time 

model_name_or_path = "sonktx/mms-tts-vie-finetuned"
model = VitsModel.from_pretrained(model_name_or_path)
tokenizer = AutoTokenizer.from_pretrained(model_name_or_path)

text = "Xin chào bạn tôi là Sơn"

inputs = tokenizer(text, return_tensors = "pt").to("cuda")

with torch.no_grad():
    output = model(**inputs).waveform

waveform = output.cpu().numpy()
if waveform.ndim > 1:
    waveform = waveform.squeeze()

output_file = "test_output.wav"
wavfile.write(output_file, model.config.sampling_rate, waveform)
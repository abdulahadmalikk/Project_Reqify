import os
os.environ['HF_TOKEN'] = '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'

from huggingface_hub import login
login(token='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')

from transformers import pipeline
print("Downloading facebook/bart-large-mnli (~1.6GB)... please wait")
p = pipeline('text-classification', model='facebook/bart-large-mnli', device=-1)
print("=" * 40)
print("DONE! Model is cached and ready.")
print("=" * 40)

let pipe = null;

const getEmbeddingPipeline = async () => {
  if (pipe) return pipe;
  console.log('🔄 Loading embedding model (first time only, ~30 seconds)...');
  const { pipeline } = await import('@xenova/transformers');
  pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('✅ Embedding model loaded');
  return pipe;
};

const generateEmbedding = async (text) => {
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(text.slice(0, 512), {
    pooling: 'mean',
    normalize: true,
  });
  // Convert to plain array
  return Array.from(output.data);
};

module.exports = { generateEmbedding };
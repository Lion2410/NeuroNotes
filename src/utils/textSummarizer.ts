
export const generateTextSummary = (content: string): string => {
  if (!content || content.length < 100) {
    return "Content too short to summarize.";
  }

  // Split content into sentences
  const sentences = content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  if (sentences.length === 0) {
    return "No meaningful content found to summarize.";
  }

  // Calculate sentence scores based on word frequency and position
  const words = content.toLowerCase().match(/\b\w+\b/g) || [];
  const wordFreq: { [key: string]: number } = {};
  
  // Count word frequencies
  words.forEach(word => {
    if (word.length > 3) { // Ignore short words
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  // Score sentences
  const sentenceScores = sentences.map((sentence, index) => {
    const sentenceWords = sentence.toLowerCase().match(/\b\w+\b/g) || [];
    let score = 0;
    
    sentenceWords.forEach(word => {
      if (wordFreq[word]) {
        score += wordFreq[word];
      }
    });
    
    // Boost score for sentences at the beginning
    if (index < sentences.length * 0.3) {
      score *= 1.5;
    }
    
    return { sentence, score, index };
  });

  // Sort by score and take top sentences
  const topSentences = sentenceScores
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(3, Math.ceil(sentences.length * 0.3)))
    .sort((a, b) => a.index - b.index);

  const summary = topSentences.map(s => s.sentence).join('. ') + '.';
  
  return summary.length > 50 ? summary : "Unable to generate meaningful summary from the content.";
};

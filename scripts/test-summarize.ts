const axios = require('axios').default;

interface SummaryResponse {
  summary: string;
  sourceMetadata: {
    author: string;
    publishDate: string;
    domain: string;
    isVerified: boolean;
  };
  aiMetrics: {
    confidenceScore: number;
    processingTime: number;
    wordCount: number;
  };
}

async function testSummarize() {
  try {
    const response = await axios.post<SummaryResponse>('http://localhost:3000/api/summarize', {
      type: 'url',
      url: 'https://www.reuters.com/technology/nvidia-shares-surge-ai-boom-drives-strong-forecast-2024-02-22/'
    });

    console.log('Summary Response:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    if (error.response) {
      console.error('Error:', error.response.data || error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

testSummarize(); 
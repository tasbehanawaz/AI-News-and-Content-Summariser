'use client';

import { useState } from 'react';

interface SummaryData {
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

export default function Home() {
  const [url, setUrl] = useState('');
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to summarize');
      }

      setSummaryData(data);
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to generate summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const VerificationBadge = ({ isVerified }: { isVerified: boolean }) => (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
      isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
    }`}>
      {isVerified ? (
        <>
          <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          Verified Source
        </>
      ) : (
        <>
          <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          Unverified Source
        </>
      )}
    </span>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <header className="mb-12 text-center">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
            AI News Summarizer
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Get authenticated and verified summaries of articles in seconds
          </p>
        </header>

        <main className="space-y-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 backdrop-blur-lg bg-opacity-90">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label 
                  htmlFor="url" 
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2"
                >
                  Article URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste article URL here"
                    className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             dark:bg-gray-700 dark:text-white transition-all duration-200
                             placeholder-gray-400 text-lg"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 
                         rounded-xl text-lg font-medium hover:opacity-90 transition-all duration-200
                         disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed
                         transform hover:-translate-y-0.5 active:translate-y-0
                         shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing & Summarizing...
                  </span>
                ) : 'Summarize'}
              </button>
            </form>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/50 border-l-4 border-red-500 p-4 rounded-lg">
              <p className="text-red-700 dark:text-red-200">{error}</p>
            </div>
          )}

          {summaryData && !error && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 backdrop-blur-lg bg-opacity-90">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-white flex items-center">
                  <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  Summary
                </h2>
                {summaryData?.sourceMetadata && (
                  <VerificationBadge isVerified={summaryData.sourceMetadata.isVerified} />
                )}
              </div>

              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400">Source</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {summaryData.sourceMetadata?.domain || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400">Author</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {summaryData.sourceMetadata?.author || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400">Published</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {summaryData.sourceMetadata?.publishDate || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed mb-6">
                  {summaryData.summary}
                </p>
                
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <span className="text-gray-500 dark:text-gray-400 mr-2">AI Confidence Score:</span>
                      <div className="flex items-center">
                        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500" 
                            style={{ width: `${summaryData.aiMetrics?.confidenceScore || 0}%` }}
                          />
                        </div>
                        <span className="ml-2 font-medium text-gray-700 dark:text-gray-300">
                          {summaryData.aiMetrics?.confidenceScore || 0}%
                        </span>
                      </div>
                    </div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Words: {summaryData.aiMetrics?.wordCount || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!summaryData && !loading && !error && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 backdrop-blur-lg bg-opacity-90">
              <div className="flex flex-col items-center justify-center h-[200px] text-gray-400 dark:text-gray-500">
                <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path>
                </svg>
                <p className="text-lg">Enter a URL to get an authenticated summary</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

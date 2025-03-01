'use client';

import { useState } from 'react';
import NewsFeed from './components/NewsFeed';

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

type TabType = 'article' | 'video' | 'browse';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('browse');
  const [url, setUrl] = useState('');
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoGenerated, setVideoGenerated] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = activeTab === 'article' ? '/api/summarize' : '/api/generate-video';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: url, // Only use the URL input
          type: 'url' // Add this line to include the type
        }),
      });

      const data = await response.json();
      
      // Log the response for debugging
      console.log('API Response:', { status: response.status, data });
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process request');
      }

      if (activeTab === 'article') {
        // Check if data has the expected structure
        if (data && data.summary && data.sourceMetadata && data.aiMetrics) {
          setSummaryData(data);
        } else {
          throw new Error('Invalid response format from server');
        }
      } else {
        if (data && data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setVideoGenerated(true);
        } else {
          throw new Error('Invalid video response format from server');
        }
      }
    } catch (error) {
      console.error('Request failed:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setError('');
    setSummaryData(null);
    setVideoGenerated(false);
    setVideoUrl('');
    setUrl('');
  };

  const clearInput = () => {
    setUrl('');
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

  const handleNewsArticleSelect = (articleUrl: string) => {
    console.log(`Article selected: ${articleUrl}`); // Debugging log
    setActiveTab('article');
    setUrl(articleUrl);
  };

  // Ensure this function is passed to the NewsFeed component
  <NewsFeed onSelectArticle={handleNewsArticleSelect} />

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <header className="mb-12 text-center">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
            AI News Summarizer
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Get authenticated summaries in text or video format
          </p>
        </header>

        <main className="space-y-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => handleTabChange('browse')}
                className={`flex-1 py-4 px-6 text-center focus:outline-none transition-colors ${
                  activeTab === 'browse'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15"/>
                  </svg>
                  Browse News
                </div>
              </button>
              <button
                onClick={() => handleTabChange('article')}
                className={`flex-1 py-4 px-6 text-center focus:outline-none transition-colors ${
                  activeTab === 'article'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  Text Summary
                </div>
              </button>
              <button
                onClick={() => handleTabChange('video')}
                className={`flex-1 py-4 px-6 text-center focus:outline-none transition-colors ${
                  activeTab === 'video'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                  Video Summary
                </div>
              </button>
            </div>

            <div className="p-8">
              {activeTab === 'browse' ? (
                <NewsFeed onSelectArticle={handleNewsArticleSelect} />
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label 
                        htmlFor="url" 
                        className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2"
                      >
                        {activeTab === 'article' ? 'Article URL' : 'News Article URL'}
                      </label>
                      <div className="relative">
                        <input
                          type="url"
                          id="url"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder={activeTab === 'article' ? "Paste article URL here" : "Paste news article URL for video summary"}
                          className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl 
                                   focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                   dark:bg-gray-700 dark:text-white transition-all duration-200
                                   placeholder-gray-400 text-lg pr-12"
                          required
                        />
                        {url && (
                          <button
                            type="button"
                            onClick={clearInput}
                            aria-label="Clear URL input"
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
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
                        {activeTab === 'article' ? 'Analyzing & Summarizing...' : 'Generating Video...'}
                      </span>
                    ) : (activeTab === 'article' ? 'Summarize' : 'Generate Video')}
                  </button>
                </form>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/50 border-l-4 border-red-500 p-4 rounded-lg">
              <p className="text-red-700 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Article Summary View */}
          {activeTab === 'article' && summaryData && !error && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 backdrop-blur-lg bg-opacity-90">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-white flex items-center">
                  <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
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

          {/* Video Summary View */}
          {activeTab === 'video' && videoGenerated && !error && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 backdrop-blur-lg bg-opacity-90">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-white flex items-center">
                  <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                  Video Summary
                </h2>
              </div>

              <div className="aspect-w-16 aspect-h-9 rounded-xl overflow-hidden">
                <video 
                  className="w-full h-full object-cover"
                  controls
                  src={videoUrl}
                  poster="/video-thumbnail.jpg"
                >
                  Your browser does not support the video tag.
                </video>
              </div>

              <div className="mt-4 flex justify-end">
                <a
                  href={videoUrl}
                  download="news-summary.mp4"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Download Video
                </a>
              </div>
            </div>
          )}

          {/* Empty State - Only show for Article and Video tabs, not for Browse tab */}
          {activeTab !== 'browse' && !summaryData && !videoGenerated && !loading && !error && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 backdrop-blur-lg bg-opacity-90">
              <div className="flex flex-col items-center justify-center h-[200px] text-gray-400 dark:text-gray-500">
                <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {activeTab === 'article' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  )}
                </svg>
                <p className="text-lg">
                  {activeTab === 'article' 
                    ? 'Enter a URL to get an authenticated summary' 
                    : 'Enter a URL to get a video summary'}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
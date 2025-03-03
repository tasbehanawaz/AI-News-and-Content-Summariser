'use client';

import { useState } from 'react';
import NewsFeed from './components/NewsFeed';
import VideoGenerator from './components/VideoGenerator';

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
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState('');

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
        body: JSON.stringify({ 
          url: url,
          type: 'url'
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process request');
      }

      if (data && data.summary && data.sourceMetadata && data.aiMetrics) {
        setSummaryData(data);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      console.error('Request failed:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleNewsArticleSelect = (articleUrl: string) => {
    console.log(`Article selected: ${articleUrl}`);
    setSelectedUrl(articleUrl);
    setShowUrlModal(true);
  };

  const handleUrlModalChoice = (choice: 'text' | 'video') => {
    if (choice === 'text') {
      setActiveTab('article');
      setUrl(selectedUrl);
    } else {
      setActiveTab('video');
      setUrl(selectedUrl);
    }
    setShowUrlModal(false);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setError('');
    setSummaryData(null);
    setVideoGenerated(false);
    setVideoUrl('');
    // Don't clear URL when switching tabs
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mb-3">
            AI News Summarizer
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Get authenticated summaries in text or video format
          </p>
        </header>

        <main>
          {/* Navigation Tabs - Now with glass effect */}
          <div className="backdrop-blur-md bg-white/30 dark:bg-gray-800/30 rounded-t-2xl border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-10">
            <div className="flex">
              <button
                onClick={() => handleTabChange('browse')}
                className={`flex-1 py-4 px-6 text-center focus:outline-none transition-all duration-200 ${
                  activeTab === 'browse'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-2xl'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15"/>
                  </svg>
                  <span>Browse News</span>
                </div>
              </button>
              <button
                onClick={() => handleTabChange('article')}
                className={`flex-1 py-4 px-6 text-center focus:outline-none transition-all duration-200 ${
                  activeTab === 'article'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-2xl'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <span>Text Summary</span>
                </div>
              </button>
              <button
                onClick={() => handleTabChange('video')}
                className={`flex-1 py-4 px-6 text-center focus:outline-none transition-all duration-200 ${
                  activeTab === 'video'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-2xl'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                  <span>Video Summary</span>
                </div>
              </button>
            </div>
          </div>

          {/* Content Area - Now with continuous design */}
          <div className="backdrop-blur-md bg-white/40 dark:bg-gray-800/40 rounded-b-2xl shadow-xl">
            <div className="p-6">
              {activeTab === 'browse' ? (
                <NewsFeed onSelectArticle={handleNewsArticleSelect} />
              ) : activeTab === 'video' ? (
                <VideoGenerator url={url} />
              ) : (
                <div className="space-y-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label 
                        htmlFor="url" 
                        className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2"
                      >
                        {activeTab === 'article' ? 'Article URL' : 'News Article URL'}
                      </label>
                      <div className="relative group">
                        <input
                          type="url"
                          id="url"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder={activeTab === 'article' ? "Paste article URL here" : "Paste news article URL for video summary"}
                          className="w-full p-4 bg-white/50 dark:bg-gray-700/50 border border-gray-200/50 dark:border-gray-600/50 rounded-xl 
                                   focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                   transition-all duration-200 group-hover:bg-white/70 dark:group-hover:bg-gray-700/70
                                   placeholder-gray-400 text-lg"
                          required
                        />
                        {url && (
                          <button
                            type="button"
                            onClick={clearInput}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 
                               rounded-xl text-lg font-medium hover:opacity-90 transition-all duration-200
                               disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed
                               transform hover:-translate-y-0.5 active:translate-y-0"
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
                </div>
              )}
            </div>
          </div>

          {/* URL Selection Modal */}
          {showUrlModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">Choose Summary Type</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  How would you like to summarize this article?
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => handleUrlModalChoice('text')}
                    className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Text Summary
                  </button>
                  <button
                    onClick={() => handleUrlModalChoice('video')}
                    className="w-full py-3 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Video Summary
                  </button>
                  <button
                    onClick={() => setShowUrlModal(false)}
                    className="w-full py-3 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/50 border-l-4 border-red-500 p-6 rounded-lg space-y-3">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-700 dark:text-red-200 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700 dark:text-red-200 font-medium">{error}</p>
              </div>
              {error.includes('forbidden') && (
                <div className="text-sm text-red-600 dark:text-red-300 pl-7">
                  <p className="font-medium mb-2">Suggestions:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Try using a different news source</li>
                    <li>Check if the article requires a subscription</li>
                    <li>Use an article from our recommended sources (Reuters, AP News)</li>
                    <li>Make sure the URL is publicly accessible</li>
                  </ul>
                </div>
              )}
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

          {/* Empty State - Only show for Article tab */}
          {activeTab === 'article' && !summaryData && !loading && !error && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 backdrop-blur-lg bg-opacity-90 mt-8">
              <div className="flex flex-col items-center justify-center h-[200px] text-gray-400 dark:text-gray-500">
                <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
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
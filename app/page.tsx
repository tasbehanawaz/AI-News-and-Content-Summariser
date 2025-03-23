'use client';

import { useState } from 'react';
import NewsFeed from './components/NewsFeed';
import VideoGenerator from './components/VideoGenerator';
import NewsletterPreferences from './components/NewsletterPreferences';
import NavMenu from './components/NavMenu';

type TabType = 'browse' | 'article' | 'video';
type PageType = TabType | 'newsletter' | 'settings' | 'account';

type SummaryType = 'text' | 'video';

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
  const [activeTab, setActiveTab] = useState<TabType>('browse');
  const [currentPage, setCurrentPage] = useState<PageType>('browse');
  const [url, setUrl] = useState<string>('');
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string>('');
  const [showUrlModal, setShowUrlModal] = useState<boolean>(false);
  const [selectedUrl, setSelectedUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleNavigate = (page: string) => {
    if (page === 'logout') {
      // Handle logout logic here
      return;
    }
    setCurrentPage(page as PageType);
  };

  const handleNewsArticleSelect = (articleUrl: string) => {
    setSelectedUrl(articleUrl);
    setShowUrlModal(true);
  };

  const handleUrlModalChoice = async (choice: SummaryType) => {
    setActiveTab(choice === 'text' ? 'article' : 'video');
    setUrl(selectedUrl);
    setShowUrlModal(false);

    if (choice === 'text') {
      setIsLoading(true);
      setError('');
      setSummaryData(null);

      try {
        const response = await fetch('/api/summarize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: selectedUrl,
            type: 'url'
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate summary');
        }

        const data = await response.json();
        setSummaryData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate summary');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'newsletter':
        return (
          <div className="relative">
            <button
              onClick={() => setCurrentPage('browse')}
              className="absolute -top-2 left-0 flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div className="pt-10">
              <NewsletterPreferences userId="default-user" />
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="relative">
            <button
              onClick={() => setCurrentPage('browse')}
              className="absolute -top-2 left-0 flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div className="bg-white/80 dark:bg-gray-800/50 rounded-2xl shadow-xl p-8 backdrop-blur-lg mt-8">
              <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white">Settings</h2>
              {/* Add settings content here */}
            </div>
          </div>
        );
      case 'account':
        return (
          <div className="relative">
            <button
              onClick={() => setCurrentPage('browse')}
              className="absolute -top-2 left-0 flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div className="bg-white/80 dark:bg-gray-800/50 rounded-2xl shadow-xl p-8 backdrop-blur-lg mt-8">
              <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white">Account</h2>
              {/* Add account content here */}
            </div>
          </div>
        );
      default:
        return (
          <>
            <div className="backdrop-blur-md bg-white/30 dark:bg-gray-800/20 rounded-t-2xl border-b border-gray-200/50 dark:border-indigo-900/50 sticky top-0 z-10 shadow-lg">
              <nav className="flex space-x-1 p-2">
                <button
                  onClick={() => setActiveTab('browse')}
                  className={`flex-1 px-4 py-2 rounded-xl transition-all ${
                    activeTab === 'browse'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  Browse News
                </button>
                <button
                  onClick={() => setActiveTab('article')}
                  className={`flex-1 px-4 py-2 rounded-xl transition-all ${
                    activeTab === 'article'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  Text Summary
                </button>
                <button
                  onClick={() => setActiveTab('video')}
                  className={`flex-1 px-4 py-2 rounded-xl transition-all ${
                    activeTab === 'video'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  Video Summary
                </button>
              </nav>
            </div>

            {activeTab === 'browse' && <NewsFeed onSelectArticle={handleNewsArticleSelect} />}
            {activeTab === 'article' && (
              <div className="mt-8">
                <div className="bg-white/80 dark:bg-gray-800/50 rounded-2xl shadow-xl p-8 backdrop-blur-lg border border-gray-200/30 dark:border-indigo-900/30">
                  <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
                      <svg className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      Get Authenticated Summary
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                      Enter the URL of any news article to get an AI-powered summary with source verification and analysis metrics.
                    </p>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setIsLoading(true);
                      setError('');
                      setSummaryData(null);

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

                        if (!response.ok) {
                          const errorData = await response.json();
                          throw new Error(errorData.error || 'Failed to generate summary');
                        }

                        const data = await response.json();
                        setSummaryData(data);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to generate summary');
                      } finally {
                        setIsLoading(false);
                      }
                    }} className="space-y-4">
                      <div>
                        <label htmlFor="article-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Article URL
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            id="article-url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com/article"
                            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 px-4 py-2 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                            required
                          />
                          <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-md flex items-center"
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                Summarizing...
                              </>
                            ) : (
                              'Summarize'
                            )}
                          </button>
                        </div>
                      </div>
                    </form>
                    
                    {error && (
                      <div className="mt-6 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-6 rounded-lg shadow-md space-y-3">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-red-700 dark:text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-red-700 dark:text-red-400 font-medium">{error}</p>
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
                  </div>
                </div>

                {summaryData && (
                  <div className="mt-8 bg-white/80 dark:bg-gray-800/50 rounded-2xl shadow-xl p-8 backdrop-blur-lg border border-gray-200/30 dark:border-indigo-900/30">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-semibold text-gray-800 dark:text-white flex items-center">
                        <svg className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        Article Summary
                      </h2>
                      {summaryData?.sourceMetadata && (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                          summaryData.sourceMetadata.isVerified ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}>
                          {summaryData.sourceMetadata.isVerified ? (
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
                      )}
                    </div>

                    {/* Source Information and AI Metrics First */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="bg-white/50 dark:bg-gray-800/30 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Source Information</h3>
                        <dl className="space-y-1">
                          <div className="flex justify-between">
                            <dt className="text-gray-600 dark:text-gray-300">Author</dt>
                            <dd className="font-medium text-gray-900 dark:text-white">{summaryData.sourceMetadata?.author || 'Unknown'}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-600 dark:text-gray-300">Published</dt>
                            <dd className="font-medium text-gray-900 dark:text-white">
                              {summaryData.sourceMetadata?.publishDate ? new Date(summaryData.sourceMetadata.publishDate).toLocaleDateString() : 'Unknown'}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-600 dark:text-gray-300">Domain</dt>
                            <dd className="font-medium text-gray-900 dark:text-white">{summaryData.sourceMetadata?.domain || 'Unknown'}</dd>
                          </div>
                        </dl>
                      </div>
                      <div className="bg-white/50 dark:bg-gray-800/30 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">AI Analysis Metrics</h3>
                        <dl className="space-y-1">
                          <div className="flex justify-between">
                            <dt className="text-gray-600 dark:text-gray-300">Confidence Score</dt>
                            <dd className="font-medium text-gray-900 dark:text-white">{summaryData.aiMetrics?.confidenceScore.toFixed(2)}%</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-600 dark:text-gray-300">Processing Time</dt>
                            <dd className="font-medium text-gray-900 dark:text-white">{summaryData.aiMetrics?.processingTime.toFixed(2)}s</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-600 dark:text-gray-300">Word Count</dt>
                            <dd className="font-medium text-gray-900 dark:text-white">{summaryData.aiMetrics?.wordCount}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    {/* Summary Content */}
                    <div className="prose dark:prose-invert max-w-none bg-white/30 dark:bg-gray-800/30 rounded-lg p-6">
                      <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-4">Summary</h3>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{summaryData.summary}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'video' && <VideoGenerator url={url} />}
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-indigo-950 dark:via-purple-950 dark:to-blue-950 bg-noise">
      <div className="max-w-7xl mx-auto px-4 py-8 relative">
        <NavMenu onNavigate={handleNavigate} />
        <header className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-400 mb-3">
            AI News Summariser
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Get authenticated summaries in text or video format
          </p>
        </header>

        <main>
          {renderContent()}
        </main>

          {showUrlModal && (
            <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800/90 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-200/50 dark:border-indigo-900/50">
                <h3 className="text-lg font-semibold mb-4 dark:text-white">Choose Summary Type</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  How would you like to summarise this article?
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => handleUrlModalChoice('text')}
                    className="w-full py-3 px-4 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-md"
                  >
                    Text Summary
                  </button>
                  <button
                    onClick={() => handleUrlModalChoice('video')}
                    className="w-full py-3 px-4 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors shadow-md"
                  >
                    Video Summary
                  </button>
                  <button
                    onClick={() => setShowUrlModal(false)}
                    className="w-full py-3 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
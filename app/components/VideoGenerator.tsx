import { useState, useEffect } from 'react';

interface VideoGeneratorProps {
  url?: string;
}

interface AvatarOption {
  id: string;
  imageUrl: string;
  label: string;
}

interface ArticleData {
  summary: string;
}

// Use only the Daisy avatar
const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: 'Daisy-inskirt-20220818', // Valid Daisy avatar ID from HeyGen
    imageUrl: '/avatars/female.jpg', // Your UI image for Daisy
    label: 'Daisy'
  }
];

interface ErrorDisplay {
  message: string;
  retryable?: boolean;
  isProcessingTimeout?: boolean;
}

export default function VideoGenerator({ url }: VideoGeneratorProps) {
  // Pre-select Daisy by default
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATAR_OPTIONS[0].id);
  // Fixed voice ID is set on the backend, so we don't need a UI for it.
  const [newsUrl, setNewsUrl] = useState<string>(url || '');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<ErrorDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [articleData, setArticleData] = useState<ArticleData | null>(null);
  const [isFetchingArticle, setIsFetchingArticle] = useState(false);

  useEffect(() => {
    if (url) {
      setNewsUrl(url);
      fetchArticleData(url);
    }
  }, [url]);

  const fetchArticleData = async (articleUrl: string) => {
    setIsFetchingArticle(true);
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: articleUrl,
          type: 'url'
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch article data');
      }

      setArticleData({
        summary: data.summary
      });
    } catch (error) {
      console.error('Error fetching article data:', error);
      setError({
        message: error instanceof Error ? error.message : 'Failed to fetch article data',
        retryable: true
      });
    } finally {
      setIsFetchingArticle(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAvatar) {
      setError({ message: 'Please select an avatar' });
      return;
    }

    if (!newsUrl) {
      setError({ message: 'Please provide a news article URL' });
      return;
    }

    setLoading(true);
    setError(null);
    setIsUsingFallback(false);
    setVideoUrl(null);

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newsUrl,
          avatarId: selectedAvatar
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMessage = data.error || 'Failed to generate video';
        setError({
          message: errorMessage,
          retryable: data.retryable ||
            errorMessage.includes('network') ||
            errorMessage.includes('connection'),
          isProcessingTimeout: errorMessage.includes('processing timed out')
        });
        return;
      }

      if (data.videoUrl) {
        // Verify the video URL is accessible
        try {
          const videoResponse = await fetch(data.videoUrl, { method: 'HEAD' });
          if (videoResponse.ok) {
            setVideoUrl(data.videoUrl);
            if (data.usedFallback) {
              setIsUsingFallback(true);
            }
            // Update only the summary
            if (data.summary) {
              setArticleData({
                summary: data.summary
              });
            }
          } else {
            throw new Error('Video URL is not accessible');
          }
        } catch (videoError) {
          setError({
            message: 'Video is still processing. Please try again in a few moments.',
            retryable: true
          });
        }
      } else {
        throw new Error('No video URL in response');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to generate video. Please try again.';
      setError({
        message: errorMessage,
        retryable: errorMessage.includes('network') || errorMessage.includes('connection'),
        isProcessingTimeout: errorMessage.includes('processing timed out')
      });
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Controls */}
        <div className="space-y-6 max-w-lg">
          <h1 className="text-2xl font-bold">News Video Generator</h1>

          {newsUrl && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Article URL:{' '}
                  <a
                    href={newsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {newsUrl}
                  </a>
                </p>
              </div>

              {isFetchingArticle ? (
                <div className="p-4 bg-gray-50 rounded-lg animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ) : articleData && (
                <div className="p-4 bg-white shadow-sm rounded-lg border border-gray-100">
                  <p className="text-gray-600 text-sm">{articleData.summary}</p>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
            {/* Avatar Selection */}
            <div className="space-y-4">
              <label className="block text-lg font-medium text-gray-900 dark:text-gray-100">
                Avatar
              </label>
              <div className="grid grid-cols-1 gap-4">
                {AVATAR_OPTIONS.map((avatar) => (
                  <div
                    key={avatar.id}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all max-w-[300px] mx-auto ${
                      selectedAvatar === avatar.id
                        ? 'border-blue-500 ring-2 ring-blue-500'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => setSelectedAvatar(avatar.id)}
                  >
                    <div className="aspect-w-3 aspect-h-4">
                      <img
                        src={avatar.imageUrl}
                        alt={avatar.label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
                      <p className="text-white text-sm text-center">{avatar.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !selectedAvatar || !newsUrl}
              className={`w-full py-3 px-6 rounded-xl text-lg font-medium transition-all duration-200 ${
                loading || !selectedAvatar || !newsUrl
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042
                      1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generating Video...
                </span>
              ) : (
                'Generate Video'
              )}
            </button>
          </form>

          {error && (
            <div className="p-4 bg-red-100 text-red-700 rounded-md">
              <p>{error.message}</p>
              {error.isProcessingTimeout ? (
                <div className="mt-2">
                  <p className="text-sm mb-2">
                    The video might be ready in your HeyGen account. You can try loading it again.
                  </p>
                  <button
                    onClick={(e) => handleSubmit(e)}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Check Video Status
                  </button>
                </div>
              ) : error.retryable && (
                <button
                  onClick={(e) => handleSubmit(e)}
                  className="mt-2 text-blue-600 hover:text-blue-800 underline"
                >
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Video Output */}
        <div className="space-y-4">
          {isUsingFallback && videoUrl && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Note: Using simplified video generation mode. The video will play basic without lip-sync.
              </p>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Generated Video</h2>
            {videoUrl ? (
              <div className="w-full">
                <div className="relative w-full rounded-lg overflow-hidden">
                  <div className="w-full" style={{ maxWidth: '800px', margin: 'auto' }}>
                    <video
                      key={videoUrl}
                      controls
                      className="w-full h-auto"
                      style={{ objectFit: 'cover' }}
                      src={videoUrl}
                      playsInline
                      onError={() => {
                        console.error('Video playback error');
                        setError({
                          message: 'Error playing the video. Please try refreshing the page.',
                          retryable: true
                        });
                      }}
                    >
                      <source src={videoUrl} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="relative w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden"
                style={{ height: '500px' }}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <svg
                    className="w-16 h-16 text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-gray-500 text-lg">
                    {loading ? 'Generating video...' : 'Your generated video will appear here'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

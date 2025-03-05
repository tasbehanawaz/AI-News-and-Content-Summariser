import { useState, useEffect } from 'react';

interface VideoGeneratorProps {
  url?: string;
}

type AvatarType = 'male' | 'female';
type VoiceType = 'male' | 'female';

interface AvatarOption {
  id: string;
  type: AvatarType;
  imageUrl: string;
  label: string;
}

const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: 'male',
    type: 'male',
    imageUrl: '/avatars/male.jpg',
    label: 'Male Presenter'
  },
  {
    id: 'female',
    type: 'female',
    imageUrl: '/avatars/female.jpg',
    label: 'Female Presenter'
  }
];

interface ErrorDisplay {
  message: string;
  retryable?: boolean;
}

export default function VideoGenerator({ url }: VideoGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<ErrorDisplay | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceType>('male');
  const [newsUrl, setNewsUrl] = useState<string>(url || '');
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  useEffect(() => {
    if (url) {
      setNewsUrl(url);
    }
  }, [url]);

  // Auto-select voice type based on avatar selection
  useEffect(() => {
    if (selectedAvatar) {
      const avatar = AVATAR_OPTIONS.find(a => a.id === selectedAvatar);
      if (avatar) {
        setSelectedVoice(avatar.type);
      }
    }
  }, [selectedAvatar]);

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

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: newsUrl,
          avatarId: selectedAvatar,
          voiceType: selectedVoice
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Failed to generate video';
        setError({
          message: errorMessage,
          retryable: data.retryable || errorMessage.includes('network') || errorMessage.includes('connection')
        });
        return;
      }

      setVideoUrl(data.videoUrl);
      if (data.usedFallback) {
        setIsUsingFallback(true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate video. Please try again.';
      setError({
        message: errorMessage,
        retryable: errorMessage.includes('network') || errorMessage.includes('connection')
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
          <h1 className="text-2xl font-bold">Video Generator</h1>
          
          {newsUrl && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Generating video for article: <a href={newsUrl} target="_blank" rel="noopener noreferrer" className="underline">{newsUrl}</a>
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
            {/* Avatar Selection */}
            <div className="space-y-4">
              <label className="block text-lg font-medium text-gray-900 dark:text-gray-100">
                Choose an Avatar
              </label>
              <div className="grid grid-cols-2 gap-4">
                {AVATAR_OPTIONS.map((avatar) => (
                  <div
                    key={avatar.id}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      selectedAvatar === avatar.id
                        ? 'border-blue-500 ring-2 ring-blue-500'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => setSelectedAvatar(avatar.id)}
                  >
                    <img
                      src={avatar.imageUrl}
                      alt={avatar.label}
                      className="w-full h-[180px] object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
                      <p className="text-white text-sm text-center">{avatar.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Voice Selection */}
            <div className="space-y-4">
              <label className="block text-lg font-medium text-gray-900 dark:text-gray-100">
                Voice Type
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedVoice('male')}
                  className={`flex-1 py-2 px-4 rounded-lg ${
                    selectedVoice === 'male'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Male Voice
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVoice('female')}
                  className={`flex-1 py-2 px-4 rounded-lg ${
                    selectedVoice === 'female'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Female Voice
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !selectedAvatar || !newsUrl}
              className={`w-full py-3 px-6 rounded-xl text-lg font-medium transition-all duration-200
                ${loading || !selectedAvatar || !newsUrl
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90'
                }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
              {error.retryable && (
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
        <div className="space-y-6">
          {isUsingFallback && videoUrl && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Note: Using simplified video generation mode. The video will play with basic animations instead of lip-sync.
              </p>
            </div>
          )}

          {videoUrl ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Generated Video</h2>
              <div className="relative mx-auto rounded-lg overflow-hidden" style={{ maxWidth: "700px", height: "420px" }}>
                <video
                  controls
                  className="absolute inset-0 w-full h-full object-cover bg-black"
                  src={videoUrl}
                  playsInline
                />
              </div>
              <div className="mt-4 flex justify-end">
                <a 
                  href={videoUrl}
                  download
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Download Video
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="relative mx-auto rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700" style={{ maxWidth: "700px", height: "420px" }}>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                  <p className="text-gray-500 text-lg">Your generated video will appear here</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
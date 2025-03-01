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

export default function VideoGenerator({ url }: VideoGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      setError('Please select an avatar');
      return;
    }

    if (!newsUrl) {
      setError('Please provide a news article URL');
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate video');
      }

      const data = await response.json();
      setVideoUrl(data.videoUrl);
      if (data.usedFallback) {
        setIsUsingFallback(true);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to generate video. Please try again.');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Video Generator</h1>
      
      {newsUrl && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            Generating video for article: <a href={newsUrl} target="_blank" rel="noopener noreferrer" className="underline">{newsUrl}</a>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar Selection */}
        <div className="space-y-4">
          <label className="block text-lg font-medium text-gray-900 dark:text-gray-100">
            Choose an Avatar
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  className="w-full aspect-square object-cover"
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
              className={`flex-1 py-3 px-4 rounded-lg ${
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
              className={`flex-1 py-3 px-4 rounded-lg ${
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
          className={`w-full py-4 px-6 rounded-xl text-lg font-medium transition-all duration-200
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

      {isUsingFallback && videoUrl && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Note: Using simplified video generation mode. The video will play with basic animations instead of lip-sync.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {videoUrl && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-3">Generated Video</h2>
          <video
            controls
            className="w-full rounded-lg"
            src={videoUrl}
          />
          <a 
            href={videoUrl}
            download
            className="mt-4 inline-block text-blue-600 hover:text-blue-800"
          >
            Download Video
          </a>
        </div>
      )}
    </div>
  );
} 
import { useState, useEffect, useCallback } from 'react';
import { NEWS_CATEGORIES, type NewsArticle } from '@/lib/news-service';
import debounce from 'lodash/debounce';

interface NewsFeedProps {
  onSelectArticle: (url: string) => void;
}

export default function NewsFeed({ onSelectArticle }: NewsFeedProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      setPage(1);
      fetchNews(1, query);
    }, 500),
    []
  );

  const fetchNews = async (pageNum: number, query: string = searchQuery) => {
    if (!hasMore && pageNum > 1) return;
    
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query) {
        params.append('query', query);
      } else {
        params.append('category', category);
      }
      params.append('page', pageNum.toString());

      const response = await fetch(`/api/news?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch news');
      }

      const newArticles = pageNum === 1 ? data.articles : [...articles, ...data.articles];
      setArticles(newArticles);
      setHasMore(newArticles.length < data.totalResults);
      setInitialLoading(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch news');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchNews(1);
  }, [category]);

  useEffect(() => {
    if (searchQuery) {
      debouncedSearch(searchQuery);
    }
  }, [searchQuery, debouncedSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setInitialLoading(true);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNews(nextPage);
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search news..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full p-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     dark:bg-gray-700 dark:text-white"
          />
        </div>
        {!searchQuery && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {NEWS_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
                          ${category === cat
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                          }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 border-l-4 border-red-500 p-4 rounded-lg">
          <p className="text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      {articles.length === 0 && !loading && !error ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No articles found. Try a different search or category.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.map((article, index) => (
            <div
              key={`${article.url}-${index}`}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onSelectArticle(article.url)}
            >
              {article.urlToImage && (
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src={article.urlToImage}
                    alt={article.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <span>{article.source.name}</span>
                  <span>•</span>
                  <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {article.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2">
                  {article.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && articles.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 
                     flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </div>
  );
} 
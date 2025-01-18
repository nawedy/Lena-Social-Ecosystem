import React, { useState } from 'react';
import { MediaCarouselItem } from '../../types/feed';

interface MediaCarouselProps {
  items: MediaCarouselItem[];
  autoPlay?: boolean;
}

const MediaCarousel: React.FC<MediaCarouselProps> = ({
  items,
  autoPlay = true,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const _goToNext = () => {
    setCurrentIndex(prev => (prev + 1) % items.length);
  };

  const _goToPrev = () => {
    setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
  };

  const _renderMediaItem = (item: MediaCarouselItem) => {
    if (item.type === 'video') {
      return (
        <video
          src={item.uri}
          className="w-full h-full object-cover"
          controls={true}
          autoPlay={autoPlay}
          loop
          playsInline
          poster={item.thumbnail}
        >
          Your browser does not support the video tag.
        </video>
      );
    }

    return (
      <img
        src={item.uri}
        alt={item.alt || ''}
        className="w-full h-full object-cover"
        style={{ aspectRatio: item.aspectRatio }}
      />
    );
  };

  return (
    <div className="relative w-full h-full">
      <div className="overflow-hidden relative rounded-lg aspect-square">
        {renderMediaItem(items[currentIndex])}

        {items.length > 1 && (
          <>
            <button
              onClick={goToPrev}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
              aria-label="Previous"
            >
              ←
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
              aria-label="Next"
            >
              →
            </button>
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              {items.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full ${
                    index === currentIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MediaCarousel;

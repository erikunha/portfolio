import { getImageProps, type ImageProps } from 'next/image';
import { preload } from 'react-dom';

export function OptimizedImage(props: ImageProps) {
  const { props: img } = getImageProps(props);
  if (props.priority) {
    preload(img.src, {
      as: 'image',
      imageSrcSet: img.srcSet,
      imageSizes: img.sizes,
      crossOrigin: img.crossOrigin,
      referrerPolicy: img.referrerPolicy,
      fetchPriority: img.fetchPriority,
    });
  }
  // biome-ignore lint/performance/noImgElement: getImageProps already resolved the optimizer srcset, sizes and loading; the client Image component would only add its runtime to every route that renders a photo.
  return <img {...img} alt={props.alt} />;
}

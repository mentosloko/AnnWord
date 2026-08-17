from pathlib import Path

path = Path('components/screens/LandingMixScreen.tsx')
text = path.read_text(encoding='utf-8')
text = text.replace("import React, { useEffect } from 'react';", "import React, { useEffect, useRef, useState } from 'react';", 1)
needle = "const asset = (name: string) => `${FINAL_ASSET}/${name}`;\n"
component = '''const asset = (name: string) => `${FINAL_ASSET}/${name}`;\n\nconst DeferredImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({ src, alt = '', ...props }) => {\n  const imageRef = useRef<HTMLImageElement>(null);\n  const [shouldLoad, setShouldLoad] = useState(false);\n\n  useEffect(() => {\n    const image = imageRef.current;\n    if (!image || !src) return;\n    if (typeof IntersectionObserver === 'undefined') {\n      setShouldLoad(true);\n      return;\n    }\n    const observer = new IntersectionObserver(([entry]) => {\n      if (!entry.isIntersecting) return;\n      setShouldLoad(true);\n      observer.disconnect();\n    }, { rootMargin: '240px 0px' });\n    observer.observe(image);\n    return () => observer.disconnect();\n  }, [src]);\n\n  return <img ref={imageRef} src={shouldLoad ? src : undefined} alt={alt} loading="lazy" decoding="async" {...props} />;\n};\n'''
if needle not in text:
    raise SystemExit('asset helper not found')
text = text.replace(needle, component, 1)

# Keep the hero eager, but defer every illustration below it until it is genuinely near the viewport.
markers = [
    '<img src={asset(`problem-',
    '<img src={asset(`step-',
    '<img src={src}',
    "<img src={asset('cta-mascot.webp')}",
    "<img src={asset('benefit-child.webp')}",
    "<img src={asset('benefit-parent.webp')}",
]
for marker in markers:
    if marker not in text:
        raise SystemExit(f'missing marker: {marker}')
    text = text.replace(marker, marker.replace('<img', '<DeferredImage'))

path.write_text(text, encoding='utf-8')
print('Deferred below-the-fold landing images.')

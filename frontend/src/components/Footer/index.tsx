import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FooterProps {
  text?: string;
  url?: string;
  className?: string;
}

// Default logo path - bundled with the package
const DEFAULT_LOGO_URL = './logo.png';

export function Footer({ 
  text = 'Powered by Pydantic UI', 
  url = 'https://github.com/idling-mind/pydantic-ui',
  className 
}: FooterProps) {
  const [logoError, setLogoError] = useState(false);

  // Don't render if no text
  if (!text) {
    return null;
  }

  const content = (
    <>
      {!logoError && (
        <img 
          src={DEFAULT_LOGO_URL} 
          alt="Pydantic UI" 
          className="h-4 w-4 object-contain"
          onError={() => setLogoError(true)}
        />
      )}
      <span>{text}</span>
      {url && <ExternalLink className="h-3 w-3 opacity-50" />}
    </>
  );

  return (
    <footer className={cn(
      'border-t bg-muted/30 px-4 py-2',
      className
    )}>
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        {url ? (
          <a 
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-foreground transition-colors"
          >
            {content}
          </a>
        ) : (
          <span className="flex items-center gap-2">
            {content}
          </span>
        )}
      </div>
    </footer>
  );
}

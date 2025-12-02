
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title?: string;
  logoText?: string | null;
  logoUrl?: string | null;
  className?: string;
}

export function Header({ title = 'Pydantic UI', logoText, logoUrl, className }: HeaderProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Determine what to show in the logo area
  const renderLogo = () => {
    if (logoUrl) {
      return (
        <img 
          src={logoUrl} 
          alt={title} 
          className="h-8 w-8 rounded-md object-contain"
        />
      );
    }
    
    // Use logoText if provided, otherwise use first letter of title
    const displayText = logoText || title.charAt(0).toUpperCase();
    
    return (
      <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
        <span className="text-primary-foreground font-bold text-sm">{displayText}</span>
      </div>
    );
  };

  return (
    <header className={cn('border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60', className)}>
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {renderLogo()}
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                {resolvedTheme === 'dark' ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="h-4 w-4 mr-2" />
                Light
                {theme === 'light' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="h-4 w-4 mr-2" />
                Dark
                {theme === 'dark' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="h-4 w-4 mr-2" />
                System
                {theme === 'system' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

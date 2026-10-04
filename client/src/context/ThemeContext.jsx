// client/src/context/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';

const ThemeContext = createContext(null);

export function applyThemeToDOM(resolved) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);

  if (resolved === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlTheme = new URLSearchParams(window.location.search).get('theme');
        if (urlTheme === 'light' || urlTheme === 'dark') {
          return urlTheme;
        }
      }
      const saved = localStorage.getItem('swifttrack_theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch (e) {
      console.warn('Unable to read theme from localStorage', e);
    }
    return 'dark';
  });

  const [systemPreference, setSystemPreference] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  const resolvedTheme = theme === 'system' ? systemPreference : theme;

  // Listen to OS system preference changes in real-time
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      const nextSystem = e.matches ? 'dark' : 'light';
      setSystemPreference(nextSystem);

      if (theme === 'system') {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (typeof document !== 'undefined' && document.startViewTransition && !prefersReducedMotion) {
          const transition = document.startViewTransition(() => {
            applyThemeToDOM(nextSystem);
          });
          transition.finished.catch(() => {});
        } else {
          if (typeof document !== 'undefined' && !prefersReducedMotion) {
            document.documentElement.classList.add('theme-transitioning');
            setTimeout(() => {
              document.documentElement.classList.remove('theme-transitioning');
            }, 400);
          }
          applyThemeToDOM(nextSystem);
        }
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [theme]);

  // Apply theme attributes to documentElement on mount or initial resolve
  useEffect(() => {
    applyThemeToDOM(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((newTheme, event) => {
    if (newTheme !== 'light' && newTheme !== 'dark' && newTheme !== 'system') return;

    const nextResolved = newTheme === 'system' ? systemPreference : newTheme;

    const saveToStorage = () => {
      try {
        localStorage.setItem('swifttrack_theme', newTheme);
      } catch (e) {
        console.warn('Unable to save theme to localStorage', e);
      }
    };

    if (nextResolved === resolvedTheme) {
      setThemeState(newTheme);
      saveToStorage();
      return;
    }

    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // View Transitions API
    if (
      typeof document !== 'undefined' &&
      document.startViewTransition &&
      !prefersReducedMotion
    ) {
      let isReveal = false;
      let x = window.innerWidth / 2;
      let y = window.innerHeight / 2;

      if (event) {
        if (typeof event.clientX === 'number' && (event.clientX !== 0 || event.clientY !== 0)) {
          x = event.clientX;
          y = event.clientY;
          isReveal = true;
        } else if (event.currentTarget && typeof event.currentTarget.getBoundingClientRect === 'function') {
          const rect = event.currentTarget.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top + rect.height / 2;
          isReveal = true;
        }
      }

      if (isReveal) {
        document.documentElement.classList.add('theme-transition-reveal');
      }

      const transition = document.startViewTransition(() => {
        flushSync(() => {
          setThemeState(newTheme);
        });
        applyThemeToDOM(nextResolved);
        saveToStorage();
      });

      if (isReveal) {
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );

        transition.ready
          .then(() => {
            try {
              document.documentElement.animate(
                {
                  clipPath: [
                    `circle(0px at ${x}px ${y}px)`,
                    `circle(${endRadius}px at ${x}px ${y}px)`
                  ]
                },
                {
                  duration: 420,
                  easing: 'cubic-bezier(0.2, 0, 0, 1)',
                  pseudoElement: '::view-transition-new(root)'
                }
              );
            } catch (err) {
              console.warn('View transition ripple animation fallback', err);
            }
          })
          .catch(() => {});

        transition.finished
          .catch(() => {})
          .finally(() => {
            document.documentElement.classList.remove('theme-transition-reveal');
          });
      } else {
        transition.finished.catch(() => {});
      }
    } else {
      // CSS transition fallback
      if (typeof document !== 'undefined' && !prefersReducedMotion) {
        document.documentElement.classList.add('theme-transitioning');
        setTimeout(() => {
          document.documentElement.classList.remove('theme-transitioning');
        }, 400);
      }
      setThemeState(newTheme);
      applyThemeToDOM(nextResolved);
      saveToStorage();
    }
  }, [resolvedTheme, systemPreference]);

  const toggleTheme = useCallback((event) => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark', event);
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

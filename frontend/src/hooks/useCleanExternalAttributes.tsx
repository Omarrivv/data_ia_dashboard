'use client';

import { useEffect } from 'react';

/**
 * Hook para limpiar atributos externos que añaden extensiones del navegador
 * Esto previene warnings de hidratación en React
 */
export function useCleanExternalAttributes() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Lista de atributos comunes añadidos por extensiones del navegador
    const externalAttributes = [
      'bis_skin_checked',
      'data-bis-skin-checked', 
      'bis_register',
      'data-bis-register',
      '__processed_8fbcd43f-60eb-486a-b9b2-3d18d8ad1f65__',
      'data-adblock',
      'data-darkreader',
      'grammarly-extension',
      'data-grammarly-shadow-root'
    ];

    const cleanAttributes = () => {
      try {
        // Limpiar desde document.body hacia abajo
        const allElements = document.querySelectorAll('*');
        
        let cleaned = 0;
        allElements.forEach(element => {
          externalAttributes.forEach(attr => {
            if (element.hasAttribute(attr)) {
              element.removeAttribute(attr);
              cleaned++;
            }
          });
        });

        if (cleaned > 0) {
          console.log(`🧹 Limpiados ${cleaned} atributos externos para evitar warnings de hidratación`);
        }
      } catch (error) {
        console.warn('Error limpiando atributos externos:', error);
      }
    };

    // Limpiar inmediatamente
    cleanAttributes();

    // Limpiar después de un breve delay (para extensiones que cargan tarde)
    const timer1 = setTimeout(cleanAttributes, 100);
    const timer2 = setTimeout(cleanAttributes, 500);
    const timer3 = setTimeout(cleanAttributes, 1000);

    // Observer para limpiar atributos cuando se añadan dinámicamente
    let observer: MutationObserver | null = null;
    
    try {
      observer = new MutationObserver((mutations) => {
        let shouldClean = false;
        
        mutations.forEach(mutation => {
          if (mutation.type === 'attributes') {
            const attr = mutation.attributeName;
            if (attr && externalAttributes.includes(attr)) {
              shouldClean = true;
            }
          }
        });

        if (shouldClean) {
          // Debounce las limpiezas para evitar bucles
          setTimeout(cleanAttributes, 10);
        }
      });

      observer.observe(document.body, {
        attributes: true,
        attributeFilter: externalAttributes,
        subtree: true
      });
    } catch (error) {
      console.warn('No se pudo configurar el observer de atributos:', error);
    }

    // Cleanup
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);
}

/**
 * Componente proveedor que limpia atributos externos globalmente
 */
export function CleanAttributesProvider({ children }: { children: React.ReactNode }) {
  useCleanExternalAttributes();
  return <>{children}</>;
}
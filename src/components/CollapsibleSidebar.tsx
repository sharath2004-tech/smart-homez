import { ChevronDown, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import "../styles/sidebar-enhancements.css";

interface NavigationItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface NavigationSection {
  id: string;
  title: string;
  icon: LucideIcon;
  items: NavigationItem[];
  defaultOpen?: boolean;
}

interface CollapsibleSidebarProps {
  sections: NavigationSection[];
  storageKey: string; // For persisting section states
}

export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  sections,
  storageKey
}) => {
  const location = useLocation();
  const { t } = useTranslation();

  // Get initial expanded state from localStorage
  const getInitialExpandedState = () => {
    const saved = localStorage.getItem(`${storageKey}_expanded`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback to default state
      }
    }
    // Default: expand sections that have active items or are marked as defaultOpen
    const defaultState: Record<string, boolean> = {};
    sections.forEach(section => {
      const hasActiveItem = section.items.some(item => location.pathname.startsWith(item.to));
      defaultState[section.id] = hasActiveItem || section.defaultOpen || false;
    });
    return defaultState;
  };

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    getInitialExpandedState
  );

  const toggleSection = (sectionId: string) => {
    const newState = {
      ...expandedSections,
      [sectionId]: !expandedSections[sectionId]
    };
    setExpandedSections(newState);
    localStorage.setItem(`${storageKey}_expanded`, JSON.stringify(newState));
  };

  const isItemActive = (itemPath: string): boolean => {
    return location.pathname === itemPath || location.pathname.startsWith(itemPath + '/');
  };

  return (
    <div className="space-y-1">
      {sections.map((section) => {
        const isExpanded = expandedSections[section.id];
        const hasActiveItem = section.items.some(item => isItemActive(item.to));
        const SectionIcon = section.icon;

        return (
          <div key={section.id} className="mb-2">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className={`sidebar-section-header sidebar-focusable w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
                hasActiveItem
                  ? 'sidebar-section-active bg-primary/10 text-primary border border-primary/20'
                  : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent'
              }`}
            >
              <div className="flex items-center gap-3">
                <SectionIcon className={`w-4 h-4 ${hasActiveItem ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                <span className="font-semibold">{section.title}</span>
              </div>
              <div className={`section-chevron transition-transform duration-200 ${isExpanded ? 'section-expanded' : 'section-collapsed'}`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </button>

            {/* Section Items */}
            <div className={`sidebar-section-content overflow-hidden transition-all duration-300 ${
              isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="ml-4 mt-1 space-y-1 sidebar-item-connector border-l border-border/30 pl-1">
                {section.items.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = isItemActive(item.to);

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`sidebar-nav-item sidebar-focusable flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-200 group ${
                        isActive
                          ? 'active bg-primary text-primary-foreground font-medium shadow-sm'
                          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                      }`}
                    >
                      <ItemIcon
                        className={`w-4 h-4 transition-colors ${
                          isActive
                            ? 'text-primary-foreground'
                            : 'text-muted-foreground group-hover:text-foreground'
                        }`}
                      />
                      <span className="group-hover:translate-x-0.5 transition-transform duration-200">
                        {typeof item.label === 'string' && item.label.includes('nav.')
                          ? t(item.label)
                          : item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
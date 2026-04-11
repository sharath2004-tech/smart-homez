import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATIC_LOCALES } from "@/i18n/config";
import enTranslations from "@/i18n/locales/en.json";
import { translateBundle } from "@/utils/googleTranslateService";
import { Globe, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const languages = [
  { code: 'en',       name: 'English',    nativeName: 'English',    flag: '🇬🇧' },
  { code: 'hi',       name: 'Hindi',      nativeName: 'हिन्दी',     flag: '🇮🇳' },
  { code: 'te',       name: 'Telugu',     nativeName: 'తెలుగు',     flag: '🇮🇳' },
  { code: 'as',       name: 'Assamese',   nativeName: 'অসমীয়া',    flag: '🇮🇳' },
  { code: 'bn',       name: 'Bengali',    nativeName: 'বাংলা',       flag: '🇮🇳' },
  { code: 'gu',       name: 'Gujarati',   nativeName: 'ગુજરાતી',    flag: '🇮🇳' },
  { code: 'kn',       name: 'Kannada',    nativeName: 'ಕನ್ನಡ',      flag: '🇮🇳' },
  { code: 'kok',      name: 'Konkani',    nativeName: 'कोंकणी',      flag: '🇮🇳' },
  { code: 'ks',       name: 'Kashmiri',   nativeName: 'كٲشُر',       flag: '🇮🇳' },
  { code: 'ml',       name: 'Malayalam',  nativeName: 'മലയാളം',     flag: '🇮🇳' },
  { code: 'mni-Mtei', name: 'Meitei',     nativeName: 'ꯃꯤꯇꯩ ꯂꯣꯟ',  flag: '🇮🇳' },
  { code: 'mr',       name: 'Marathi',    nativeName: 'मराठी',       flag: '🇮🇳' },
  { code: 'ne',       name: 'Nepali',     nativeName: 'नेपाली',      flag: '🇮🇳' },
  { code: 'or',       name: 'Odia',       nativeName: 'ଓଡ଼ିଆ',      flag: '🇮🇳' },
  { code: 'pa',       name: 'Punjabi',    nativeName: 'ਪੰਜਾਬੀ',     flag: '🇮🇳' },
  { code: 'sa',       name: 'Sanskrit',   nativeName: 'संस्कृतम्',   flag: '🇮🇳' },
  { code: 'sat',      name: 'Santali',    nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ',   flag: '🇮🇳' },
  { code: 'sd',       name: 'Sindhi',     nativeName: 'سنڌي',        flag: '🇮🇳' },
  { code: 'ta',       name: 'Tamil',      nativeName: 'தமிழ்',       flag: '🇮🇳' },
  { code: 'ur',       name: 'Urdu',       nativeName: 'اردو',        flag: '🇮🇳' },
];

interface LanguageSelectorProps {
  variant?: 'icon' | 'full';
}

export function LanguageSelector({ variant = 'icon' }: LanguageSelectorProps) {
  const { i18n, t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const changeLanguage = async (lng: string) => {
    if (lng === i18n.language) return;

    // Languages with static locale files switch instantly
    if ((STATIC_LOCALES as readonly string[]).includes(lng)) {
      i18n.changeLanguage(lng);
      return;
    }

    // For all other Indian languages, fetch translations via Google Translate
    // and add them to i18next before switching.
    if (!i18n.hasResourceBundle(lng, 'translation')) {
      setLoading(true);
      try {
        const translated = await translateBundle(enTranslations, lng);
        i18n.addResourceBundle(lng, 'translation', translated, true, true);
      } catch (err) {
        console.error('Google Translate error, falling back to English:', err);
        // Fall back gracefully — UI stays in English which is already loaded
        i18n.changeLanguage('en');
        return;
      } finally {
        setLoading(false);
      }
    }

    i18n.changeLanguage(lng);
  };

  const currentLanguage = languages.find(lang => lang.code === i18n.language) ?? languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'full' ? (
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            <span className="flex-1 text-left">{currentLanguage.nativeName}</span>
          </button>
        ) : (
          <Button variant="ghost" size="icon" className="relative" disabled={loading}>
            {loading
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <Globe className="h-5 w-5" />}
            <span className="sr-only">Select language</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 max-h-96 overflow-y-auto">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            className={`cursor-pointer flex items-center gap-2 ${
              i18n.language === language.code ? 'bg-accent' : ''
            }`}
          >
            <span className="text-lg">{language.flag}</span>
            <div className="flex flex-col">
              <span className="font-medium">{language.nativeName}</span>
              <span className="text-xs text-muted-foreground">{language.name}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


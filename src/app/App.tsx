import { EditorScreen } from '../features/editor/EditorScreen';
import { LibraryScreen } from '../features/library/LibraryScreen';
import { PreferencesScreen } from '../features/preferences/PreferencesScreen';
import { PrompterScreen } from '../features/prompter/PrompterScreen';
import { fr } from '../i18n/fr';
import { isDirty, useSession } from '../stores/sessionStore';
import { DialogHost } from '../ui/DialogHost';
import { ToastHost } from '../ui/ToastHost';
import { navigate, useRoute, type Route } from './router';

const NAV: { route: Route; label: string }[] = [
  { route: 'editor', label: fr.nav.editor },
  { route: 'library', label: fr.nav.library },
  { route: 'preferences', label: fr.nav.preferences },
];

function Header({ route }: { route: Route }) {
  const dirty = useSession((s) => isDirty(s.draft, s.saved));
  return (
    <header className="app-header">
      <span className="app-name">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="28" height="28" />
        {fr.appName}
      </span>
      <nav aria-label="Navigation principale">
        {NAV.map((item) => (
          <a
            key={item.route}
            href={
              item.route === 'editor'
                ? '#/'
                : item.route === 'library'
                  ? '#/prompts'
                  : '#/preferences'
            }
            aria-current={route === item.route ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate(item.route);
            }}
          >
            {item.label}
            {item.route === 'editor' && dirty && (
              <span className="dot" aria-label={fr.editor.modified} />
            )}
          </a>
        ))}
      </nav>
    </header>
  );
}

export function App() {
  const route = useRoute();
  const prompter = route === 'prompter';
  return (
    <>
      {!prompter && (
        <>
          <Header route={route} />
          <main className="app-main">
            {route === 'editor' && <EditorScreen />}
            {route === 'library' && <LibraryScreen />}
            {route === 'preferences' && <PreferencesScreen />}
          </main>
        </>
      )}
      {prompter && <PrompterScreen />}
      <DialogHost />
      <ToastHost />
    </>
  );
}

import { lazy } from 'react';

// Lazy load route components\nexport const HomePage = lazy(() => import('../pages/Home'));\nexport const ConversationPage = lazy(() => import('../pages/Conversation'));\nexport const SettingsPage = lazy(() => import('../pages/Settings'));\nexport const ProfilePage = lazy(() => import('../pages/Profile'));\nexport const AdminPage = lazy(() => import('../pages/Admin'));

// Lazy load heavy components\nexport const MarkdownEditor = lazy(() => import('../components/MarkdownEditor'));\nexport const ArtifactViewer = lazy(() => import('../components/ArtifactViewer'));\nexport const ChartRenderer = lazy(() => import('../components/ChartRenderer'));\nexport const DataTable = lazy(() => import('../components/DataTable'));

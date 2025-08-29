import { lazy } from 'react';

// Lazy load route components
export const HomePage = lazy(() => import('../pages/Home'));
export const ConversationPage = lazy(() => import('../pages/Conversation'));
export const SettingsPage = lazy(() => import('../pages/Settings'));
export const ProfilePage = lazy(() => import('../pages/Profile'));
export const AdminPage = lazy(() => import('../pages/Admin'));

// Lazy load heavy components
export const MarkdownEditor = lazy(() => import('../components/MarkdownEditor'));
export const ArtifactViewer = lazy(() => import('../components/ArtifactViewer'));
export const ChartRenderer = lazy(() => import('../components/ChartRenderer'));
export const DataTable = lazy(() => import('../components/DataTable'));

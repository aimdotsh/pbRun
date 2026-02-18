import { redirect } from 'next/navigation';
import SettingsClient from './SettingsClient';

export default function SettingsPage() {
  const isDev = process.env.NODE_ENV === 'development';
  const isEnabled = process.env.ENABLE_SETTINGS_PAGE === 'true';
  
  if (!isDev && !isEnabled) {
    redirect('/');
  }
  
  return (
    <div className="min-h-screen bg-emerald-950">
      <SettingsClient />
    </div>
  );
}

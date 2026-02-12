import { redirect } from 'next/navigation';

export default function PagesIndex() {
  redirect('/pages/list');
}

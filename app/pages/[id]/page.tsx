import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getActivityById, getActivityLaps, getActivityRecords } from '@/app/lib/db';
import ActivityDetailClient from './ActivityDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ActivityDetailPage({ params }: PageProps) {
  const { id } = await params;

  if (!id) {
    return (
      <div className="text-zinc-500">无效的活动 ID</div>
    );
  }

  // 支持字符串 ID（COROS: coros_xxx）和数字 ID（Garmin）
  const activityId = id;

  const [activity, laps, records] = await Promise.all([
    getActivityById(activityId),
    Promise.resolve(getActivityLaps(activityId)),
    Promise.resolve(getActivityRecords(activityId)),
  ]);

  if (!activity) {
    notFound();
  }

  return <ActivityDetailClient activity={activity} laps={laps} records={records} />;
}

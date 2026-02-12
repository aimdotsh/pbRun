import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Garmin 跑步数据
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          查看与统计你的 Garmin 活动数据，包括跑步时间、距离、配速、心率、步频与分段数据。
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/pages/list"
          className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        >
          <span className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            活动列表
          </span>
          <span className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            按时间查看所有跑步活动，含距离、配速等
          </span>
        </Link>
      </section>
    </div>
  );
}

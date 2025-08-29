export default function Home() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">공지사항</h1>
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <ul className="list-disc pl-5 space-y-2">
          <li>ADplus 베타 운영 중입니다.</li>
          <li>광고 트래킹 엔드포인트: <code>/api/track?adCode=도메인_회원_광고</code></li>
          <li>집계는 대시보드에서 확인하세요.</li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold">이용 안내</h2>
      <div className="rounded-xl border bg-white p-5 shadow-sm space-y-2">
        <p>좌측 상단 메뉴로 대시보드/광고 설정/로그 조회로 이동할 수 있어요.</p>
        <p>로그인 후 더 많은 기능을 사용하실 수 있습니다.</p>
      </div>
    </div>
  );
}

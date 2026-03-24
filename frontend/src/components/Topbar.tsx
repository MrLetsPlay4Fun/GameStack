interface TopbarProps {
  title: string;
}

export default function Topbar({ title }: TopbarProps) {
  return (
    <div className="h-12 bg-[#313338] border-b border-[#1e1f24] flex items-center px-4 flex-shrink-0 shadow-sm">
      <h1 className="text-white font-semibold text-base">{title}</h1>
    </div>
  );
}

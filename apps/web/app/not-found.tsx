import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <div className="relative z-10 flex h-screen w-screen flex-col items-center justify-center gap-6">
        <h1 className="font-display bg-gradient-to-r from-black to-neutral-600 bg-clip-text text-5xl font-semibold text-transparent">
          404
        </h1>
      </div>
    </>
  );
}

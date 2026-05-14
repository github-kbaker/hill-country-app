import { Phone, Snowflake } from 'lucide-react';

export const StickyCallBar = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex lg:hidden bg-white border-t border-gray-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      <a 
        href="tel:830-353-0845" 
        className="flex-1 flex flex-col items-center justify-center py-3 bg-primary text-white active:bg-green-800 transition-colors"
      >
        <Phone size={20} />
        <span className="text-[10px] font-bold mt-1 tracking-wider">CALL MAIN</span>
      </a>
      <div className="w-[1px] bg-green-700"></div>
      <a 
        href="tel:830-353-3177" 
        className="flex-1 flex flex-col items-center justify-center py-3 bg-secondary text-white active:bg-black transition-colors"
      >
        <Snowflake size={20} className="text-blue-300" />
        <span className="text-[10px] font-bold mt-1 tracking-wider uppercase">Refrigeration</span>
      </a>
    </div>
  );
};

import { CSSProperties, FC, ReactNode } from 'react';

interface ShimmeringTitleProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const ShimmeringTitle: FC<ShimmeringTitleProps> = ({
  children,
  className = '',
  style,
}) => {
  return (
    <div
      className="flex items-center justify-center overflow-hidden"
      style={style}
    >
      <a
        className={`animate-shiny relative inline-block [-webkit-mask-image:linear-gradient(-75deg,rgba(0,0,0,.3)_30%,#000_50%,rgba(0,0,0,.3)_70%)] [-webkit-mask-size:200%] ${className} `}
      >
        {children}
      </a>
    </div>
  );
};

export default ShimmeringTitle;

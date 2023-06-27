import { Handle, useStore } from "reactflow";
import useGlobalMousePosition, { useAppSelector, useAppDispatch } from "@/util/hooks";
import { renderToString } from 'react-dom/server';
import { FaArrowRight } from "react-icons/fa";
import { useSelector } from "react-redux";

const defaultSize = (s, id) => {
    const node = s.nodeInternals.get(id);
    if (!node) { return };
    return {
      x: node.positionAbsolute.x,
      y: node.positionAbsolute.y,
      width: node.width,
      height: node.height,
      minHeight: 35,
      minWidth: 60,
    };
  }

function calculateDistanceToEdges(mouse, box) {
    var boxLeft = box.x;
    var boxTop = box.y;
    var boxRight = box.x + box.width;
    var boxBottom = box.y + box.height;
  
    var dx = Math.max(boxLeft - mouse.x, 0, mouse.x - boxRight);
    var dy = Math.max(boxTop - mouse.y, 0, mouse.y - boxBottom);
  
    return Math.sqrt(dx * dx + dy * dy);
}

export default function HandleWrapper({ type, id, nodeid, position, variant }) {
    const edges = useAppSelector((state) => state.windows.edges);
    const settings = useAppSelector((state) => state.windows.settings);
    
    const nodesize = useStore(s => defaultSize(s, nodeid) );
    const mousePosition = useGlobalMousePosition();
    const distance = calculateDistanceToEdges(mousePosition, nodesize);

    const connected = edges.reduce((acc, e) => e.sourceHandle == id || e.targetHandle == id || acc, false)

    const showHandles = distance < 100 || connected ? true : false;
    

    const svgString = renderToString(
        <FaArrowRight />
    );

    const size = 6;

    const stylebase = {
        width: `${size * 2}px`,
        height: `${size * 2}px`,
        position: "fixed",
        border: `2px solid ${settings.color}`,
        borderRadius: `2px`,
        paddingLeft: `2px`,
        backgroundColor: settings.color,
        backgroundImage: `url('data:image/svg+xml,${encodeURIComponent(svgString)}')`,
        backgroundSize: "contain",
        filter: `invert(1) hue-rotate(180deg)`,
        transition: `opacity 0.3s ease`,
        opacity: showHandles ? 1 : 0
    }

    const style = () => { 
        if (variant == "source") {
            return {
                transform: `translate(-100%, -125%)`,
                // left: `-${size * 2}px`,
                // top: `${size}px`,
                ...stylebase,
            }
        }

        if (variant == "control") {
            return {
                transform: `translate(-100%, 25%)`,
                // bottom: `${size}px`,
                ...stylebase,
            }
        }
        
        if (variant == "output") {
            return {
                // transform: `translate(100%, 0)`,
                right: `-${size * 3}px`,
                ...stylebase,
            }
        }

        return stylebase
    }



    return (
        <Handle type={type} id={id} position={position} style={style()} />
    )
}

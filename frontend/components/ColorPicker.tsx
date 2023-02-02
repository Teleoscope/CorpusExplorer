import React from 'react';
import { CompactPicker } from 'react-color';
// actions
import { useAppSelector, useAppDispatch } from '../hooks'
import { RootState } from '../stores/store'
import { Stomp } from './Stomp'


export default function ColorPicker(props) {
    const userid = useAppSelector((state) => state.activeSessionID.userid);  
    const session_id = useAppSelector((state) => state.activeSessionID.value);  

    const client = Stomp.getInstance();
    client.userId = userid;


   const [state, setState] = React.useState({
        background: props.defaultColor,
    })

  const handleChangeComplete = (color) => {
    setState({ background: color.hex });
    console.log("recoloring to", color)
    client.recolor_session(color.hex, session_id)

  };

  
    return (
        <div style={{padding:"1em"}}>
      <CompactPicker
        style={{border: "none"}}
        color={ state.background }
        onChangeComplete={ handleChangeComplete }
      />
      </div>
    );
}


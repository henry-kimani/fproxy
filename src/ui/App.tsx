import './App.css';
import { useState } from "react";

function App() {

  const [ sessionKey, setSessionKey ] = useState<string | undefined>();
  const [ logs, setLogs ] = useState<string[] | undefined>();

  //@ts-ignore
  window.electron.send("send-session-key");
  //@ts-ignore
  window.electron.receive("session-key-command", (sessionKey) => {
    setSessionKey(sessionKey);
  });

  //@ts-ignore
  window.electron.receive("logs-command", (data) => {
    if (!logs) {
      setLogs([data]);
      return;
    }
    const clone = logs.slice();
    clone.push(data);
    setLogs(logs);
    console.log(logs);
  });

  return (
    <>
      <main className='main'>
        <section className='card'>
          <h1 className='title'>FPROXY</h1>
          { sessionKey &&
            <span>
              <strong>Session Key</strong>
              <p>{sessionKey}</p>
            </span>
          }
          <div className='divider'></div>
          {logs &&
            <>
            <div>
              <strong>Message</strong>
              {logs?.map((log, index) => (
                <p key={index}>{log}</p>
              ))}
            </div>
            <div className='divider'></div>
            </>
          }
        </section>
      </main>
    </>
  )
}

export default App;

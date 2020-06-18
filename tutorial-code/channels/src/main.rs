use tokio::sync::{oneshot, mpsc};
use mini_redis::client;

/// Multiple different commands are multiplexed over a single channel.
enum Command {
    Get {
        key: String,
        tx: Responder<Option<Bytes>>,
    },
    Set {
        key: String,
        val: Vec<u8>,
        tx: Responder<()>,
    },
}

/// Provided by the requester and used by the manager task to send the command
/// response back to the requester.
type Responder<T> = oneshot::Sender<mini_redis::Result<T>>;

#[tokio::main]
async fn main() {
    let (mut tx, mut rx) = mpsc::channel(32);
    // Clone a `tx` handle for the second f
    let mut tx2 = tx.clone();

    let manager = tokio::spawn(async move {
        // Open a connection to the mini-redis address.
        let mut client = client::connect("127.0.0.1:6379").await.unwrap();

        while let Some(cmd) = rx.recv().await {
            match cmd {
                Command::Get { key, tx }=> {
                    let res = client.get(&key).await;
                    tx.send(res);
                }
                _ => unimplemented!(),
            }
        }
    });

    // Spawn two tasks, each setting a value
    let t1 = tokio::spawn(async move {
        let (resp_tx, resp_rx) = oneshot::channel();
        let cmd = Command::Get {
            key: "hello".into(),
            tx: resp_tx,
        };

        // Send the GET request
        tx.send(cmd).await;

        // Await the response
        let res = resp_rx.await;
        println!("GOT = {:?}", res);
    });

    let t2 = tokio::spawn(async move {
        let (resp_tx, resp_rx) = oneshot::channel();
        let cmd = Command::Set {
            key: "foo".to_string(),
            val: b"bar".to_vec(),
            tx: resp_tx,
        };
        
        // Send the SET request
        tx2.send(cmd).await;

        // Await the response
        let res = resp_rx.await;
    });

    t1.await.unwrap();
    t2.await.unwrap();
}
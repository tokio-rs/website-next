use tokio::sync::mpsc;
use mini_redis::client;

#[tokio::main]
async fn main() {
    let (mut tx, mut rx) = mpsc::channel(32);
    // Clone a `tx` handle for the second f
    let mut tx2 = tx.clone();

    let manager = tokio::spawn(async move {
        // Open a connection to the mini-redis address.
        let mut client = client::connect("127.0.0.1:6379").await.unwrap();

        while let Some((key, value)) = rx.recv().await {
            let res = client.set(key, value).await;
        }

        unimplemented!();
    });

    // Spawn two tasks, each setting a value
    let t1 = tokio::spawn(async move {
        tx.send(("hello", b"world".to_vec().into())).await;
    });

    let t2 = tokio::spawn(async move {
        tx2.send(("foo", b"bar".to_vec().into())).await;
    });

    t1.await.unwrap();
    t2.await.unwrap();

    // // Set the key "hello" with value "world"
    // client.set("hello", "world".into()).await?;

    // // Get key "hello"
    // let result = client.get("hello").await?;

    // println!("got value from the server; result={:?}", result);
}
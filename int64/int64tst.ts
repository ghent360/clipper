import {Int64} from "./int64";

function int64Test() {
  console.log('int64 success');
  let a = Int64.fromNumber(0x100000000);
  let b = Int64.fromNumber(0x100000000);
  let c = a.add(b);
  console.log('c = 0x%s', c.toNumber().toString(16));
}

Int64.init().then(() => int64Test());
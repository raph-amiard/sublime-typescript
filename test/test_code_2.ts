///<reference path='test_dep.ts'/>

declare var console;

class Test {
	public test () {
		console.log("oh hai");
	}
	public test_2(a : number, b : number) : number {
		return a + b;
	}
}

var v : C1 = new C1();
var a : number = v.testMeth2(12, 15);
var t : Test = new Test();
v.pubMeth();
var v2 : C1 = new C1();

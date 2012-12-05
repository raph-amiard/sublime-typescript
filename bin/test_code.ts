declare var document;
declare var alert;
module Foo {
	var testing = ""; 
}

class C1 {
	public pubMeth() {this.pubMeth();} // test on 'this.'
	private privMeth() {}
	public pubProp = 0;
	private privProp = 0;
	public testMeth() {
		this.pubMeth()
		return this;
	}
}

var f = new C1();
f.pubMeth(); // test on F.
module M {
    export class C { 
    	public pub = 0; 
    	private priv = 1; 
    	public test = 123;
    }
    export var V = 0;
}


var c = new M.C();

class Greeter {
	greeting: string;
	constructor (message: string) {
		this.greeting = message;
	}
	greet() {
		return "Hello, " + this.greeting;
	}
}   

var greeter = new Greeter("world");
greeter.greet() // test on greeter.
var gr2 : Greeter = new Greeter("haha");

var button = document.createElement('button')
button.innerText = "Say Hello"
button.onclick = function() {
	alert(greeter.greet())
}

document.body.appendChild(button)

module Foo {     var testing = "";     test }

class C1 {
	public pubMeth() {this.} // test on 'this.'
	private privMeth() {}
	public pubProp = 0;
	private privProp = 0;
}

var f = new C1();
f. // test on F.
module M {
    export class C { public pub = 0; private priv = 1; }
    export var V = 0;
}


var c = new M.C();

c. // test on c.

//Test for comment
//c.  

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
greeter. // test on greeter.

var button = document.createElement('button')
button.innerText = "Say Hello"
button.onclick = function() {
	alert(greeter.greet())
}

document.body.appendChild(button)

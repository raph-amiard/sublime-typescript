
class C1 {
	public pubMeth() {this.pubMeth();} // test on 'this.'
	private privMeth() {}
	public pubProp = 0;
	private privProp = 0;
	public testMeth() {
		this.pubMeth()
		return this;
	}
	public testMeth2(a : number, b : number) {
		return a - b;
	}
}

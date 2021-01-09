/*
 	创建一个Vue对象
	
 * */
class Vue {
	
	//参数为传入Vue当中的设置对象
	constructor(options) {
	
		this.$data = options.data
		//获取对应的dom元素
		this.$el = document.querySelector(options.el);
	
		//将所有的$data转换为响应式（可观察）
		observe(this.$data)
		//将元素与数据进行视图解析
	    compile(this.$el, this.$data)
	}

}

/*
 	创建将数据转为响应式的Observe函数（观察者）
 	参数为需要转换的data
 	
 * */
function observe(data) {
	
	//首先需要判断data是不是对象，之后再进行遍历
	//这里通过Object原型上的toString方法来判断data是否为对象
	if(Object.prototype.toString.call(data) === '[object Object]') {
		
		//对data对象进行遍历，首先获取到data当中的所有属性
		Object.keys(data).forEach(key => {
			
			//进行数据响应式转化
			defineReactive(data, key, data[key])
			
			//递归进行数据转换（需要判断属性值是不是对象）
			observe(data[key])
			
		})
		
		
	}
	
}

/*
 	创建通过Object的defineProperty函数来进行数据监听的defineReactive函数
 	参数为监听对象，监听对象的属性以及监听对象的属性对应值
 	
 * */
function defineReactive(obj, key, val) {
	//在这里我们需要一个Dep依赖对象实例（调度中心）实例
	//每一个绑定数据都需要一个dep实例
	const dep = new Dep()
	
	//进行数据监听
	Object.defineProperty(obj, key, {
		
		get() {
			
			//Dep依赖对象添加相关的Watcher
			Dep.target && dep.addSub(Dep.target)
			return val
			
		},
		
		set(newVal) {
			
			//判断新值是否与旧值相等
			if(val === newVal) return;
			//如果不相等就赋值，并重新进行数据响应式转换
			val = newVal
			observe(newVal)
			//dep对象实例通知所有与之相关的Watcher更新
			dep.notify()
			
		}
		
	})
	
}

/*
 	创建视图解析函数（compiler）
 	参数为vue挂载的元素与vue的数据
 * */
function compile(el, data) {
	
	//获取el所有的子元素转存进数组并且遍历
	[].slice.call(el.childNodes).forEach(node => {
		
		/*
		 	需要判断节点的类型
		 	html节点（元素节点）
		 	文字节点（如{{ message }}）
		 * */
		if(node.nodeType === 1) {
			
			//如果是元素节点就进行递归
			compile(node, data)
			
		} 
		else if(node.nodeType === 3) {
			
			//如果是文字节点，将文字解析
			compileText(node, data)
			
		}
		
	})
	
}

/*
 	视图文本解析函数compileText
 	参数为元素以及数据
 * */
function compileText(node, data) {
	
	//对于节点中的文本进行解析
	let exp = textToExp(node.textContent)
	
	//创建观察者
	new Watcher(exp, data, newVal => {
		
		node.textContent = newVal
		
	})
	
}

/*
 	解析文字节点的函数（通过正则表达式来实现）
 	参数为传入的文本
 * */
function textToExp(text) {
	
	//将对应文本根据{{  }}来对字符串进行截取
	let fragments = text.split(/({{.+?}})/g)
	
    //对于片段中的每一个元素进行遍历替换
    fragments = fragments.map(fragment => {
        if (fragment.match(/{{.+?}}/g)) {
            fragment = '(' + fragment.replace(/^{{|}}$/g, '') + ')'
        } else {
            fragment = '`' + fragment.replace(/`/g, '\\`') + '`'
        }
        return fragment
    });
    
    //最后将文本片段拼接为字符串
    return fragments.join('+')
	
}

/*
 	创建Dep依赖对象（发布者）
 	可以理解为依赖于对应数据的Watcher集合（主要用于存储订阅者Watcher，通知订阅者）
 	
 * */
class Dep {
	
	constructor() {
		
		//创建一个订阅者Watcher集合
		this.subs = new Set()
		
	}
	
	//添加订阅者
	addSub(watcher) {
		
		this.subs.add(watcher)
		
	}
	
	//通知所有的订阅者数据更新
	notify() {
		
		//遍历subs数组
		for(let sub of this.subs) {
			
			//subs数组的每一个元素都是对应数据的订阅者watcher
			//watcher上由一个方法update（更新）
			sub.update()
		}
		
	}
	
}

//初始化Dep.target
Dep.target = null

/*
 	创建观察者对象（Watcher）
 * */
class Watcher {
	
	constructor(exp, data, callback) {
		
	    this.oldVal = null
	    this.getter = expToFuntion(exp, data)
	    this.callback = callback
	    //创建新watcher时需要进行一次更新
	    this.update()
	    
	}
	
	//用来检测获取值，并将Dep.target指向这个watcher
	get() {
		
		//将Dep.target指向这个watcher
		Dep.target = this
		/*
			通过调用getter获取到值
			当getter调用时会触发data的数据监听
			此时就需要将Watcher添加进去
		 */
		let value = this.getter()
		//将Dep.target清空
		Dep.target = null
		return value
		
	}
	
	//构造函数中传入的callback回调函数在update中被调用
	update() {
		
		//获取值
		let newVal = this.get()
		
		//如果数据发生了更新
		if(newVal !== this.oldVal) {
			
			//旧值更新
			this.oldVal = newVal
			
			//如果callback存在则被调用
			this.callback && this.callback(newVal)
			
		}
		
	}
	
}

/*
 	创建转换函数expToFuntion
 	参数为textToExp转换的文本和data
 * */
function expToFuntion(exp, data) {
	
	/*
	 	通过with关键字（很少见，之前在《你所不知道的JavaScript》中有见到）
		正常情况下不推荐使用with关键字
		此处并不会产生影响，所以使用了with关键字
	*/
	return new Function('with(this){return ' + exp + '}').bind(data)
	
}